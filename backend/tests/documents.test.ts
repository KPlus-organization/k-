import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { test } from "node:test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { xml2js, type Element } from "xml-js";
import {
  getTemplate,
  createDocx,
  renderDocument,
  matches,
  type Values,
} from "../src/services/documents";
import { env } from "../src/config/env";
import { pool } from "../src/config/db";
import { api, apiUrl, registerUser, setupApi } from "./helpers";

setupApi();

test("DOCX keeps source page settings, styles and paragraph formatting, without instructions or optional placeholders", async () => {
  const template = await getTemplate("code-claim");
  assert.equal(
    template.fields.find((field) => field.id === "phone")?.hint,
    undefined,
  );
  assert.match(
    template.fields.find((field) => field.id === "bik")!.hint!,
    /9 цифр/,
  );
  const fields = await filled({
    moneyType: "fixed",
    attachment3: "Сравнительная таблица",
    pages3: "2",
    circumstances: "Первая строка\nВторая строка <проверка> & текст",
  });
  const file = await createDocx(template, fields);
  const source = await JSZip.loadAsync(
    await readFile(
      path.join(env.contentDir, "templates", "code-claim-source.docx"),
    ),
  );
  const generated = await JSZip.loadAsync(file);
  for (const entry of [
    "word/styles.xml",
    "word/theme/theme1.xml",
    "word/fontTable.xml",
    "word/settings.xml",
  ]) {
    assert.equal(
      await generated.file(entry)!.async("string"),
      await source.file(entry)!.async("string"),
      entry,
    );
  }
  const child = (node: Element, name: string) =>
    node.elements!.find((item) => item.name === name)!;
  const body = (xml: string) =>
    child(child(xml2js(xml) as Element, "w:document"), "w:body");
  const original = body(
    await source.file("word/document.xml")!.async("string"),
  );
  const xml = await generated.file("word/document.xml")!.async("string");
  const output = body(xml);
  assert.deepEqual(child(output, "w:sectPr"), child(original, "w:sectPr"));
  const originalParagraphs = original.elements!.filter(
    (item) => item.name === "w:p",
  );
  const outputParagraphs = output.elements!.filter(
    (item) => item.name === "w:p",
  );
  const rendered = renderDocument(template, fields);
  let cursor = 0;
  for (const paragraph of rendered) {
    if (paragraph.blankBefore !== undefined) {
      assert.deepEqual(
        outputParagraphs[cursor++],
        originalParagraphs[paragraph.blankBefore],
      );
    }
    assert.deepEqual(
      child(outputParagraphs[cursor++], "w:pPr"),
      child(originalParagraphs[paragraph.sourceParagraph!], "w:pPr"),
      paragraph.text.slice(0, 40),
    );
  }
  assert.equal(cursor, outputParagraphs.length);
  assert.match(xml, /<w:br\s*\/>/);
  assert.match(xml, /Вторая строка &lt;проверка&gt; &amp; текст/);
  assert.doesNotMatch(xml, /Приложения|Сравнительная таблица, на 2 л\./);
  assert.ok(template.fields.every((field) => field.group !== "attachments"));
  assert.ok(template.attachmentGuidance);
  for (const text of [
    template.attachmentGuidance.title,
    template.attachmentGuidance.intro,
    ...template.attachmentGuidance.items,
    template.attachmentGuidance.note,
  ]) {
    assert.ok(!xml.includes(text), "attachment guidance must not be exported");
  }
  assert.doesNotMatch(
    xml,
    /\{\{|ВАРИАНТ|Обратитесь к статье|\[Должность|\[Название|ИНН получателя:|Дополнительные сведения:/,
  );
  for (const field of template.fields)
    if (field.hint) assert.ok(!xml.includes(field.hint), field.id);
  for (const reference of template.references ?? []) {
    assert.ok(!xml.includes(reference.title));
    assert.ok(!xml.includes(reference.href));
  }
  // A reviewable artifact for checking the generated file in Word.
  await mkdir(path.join(env.contentDir, "..", "tmp", "preview"), {
    recursive: true,
  });
  await writeFile(
    path.join(
      env.contentDir,
      "..",
      "tmp",
      "preview",
      "inline-claim-sample.docx",
    ),
    file,
  );
});

test("legacy favorites keep their original text and fields while gaining inline controls, hints and source formatting", async () => {
  const owner = await registerUser();
  const id = randomUUID();
  const template = JSON.parse(
    await readFile(
      path.join(process.cwd(), "tests", "fixtures", "code-claim-v1.json"),
      "utf8",
    ),
  );
  const fields = await filled({
    moneyType: "fixed",
    recipient: "Адресат старого документа",
    attachment1: "Старое приложение, которое не должно попасть в экспорт",
    pages1: "3",
  });
  await pool.query(
    "INSERT INTO saved_documents (id,user_id,title,template_id,template_version,template,fields,complete) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      id,
      owner.user.id,
      "Старый документ",
      template.id,
      1,
      JSON.stringify(template),
      JSON.stringify(fields),
      true,
    ],
  );
  const response = await api("GET", `/api/documents/${id}`, {
    token: owner.accessToken,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.templateVersion, 1);
  assert.deepEqual(
    response.body.template.paragraphs.map((p: { text: string }) => p.text),
    template.paragraphs
      .filter(
        (p: { text: string }) =>
          p.text !== "Приложения" && !p.text.includes("{{attachment"),
      )
      .map((p: { text: string }) => p.text),
  );
  assert.equal(response.body.fields.recipient, fields.recipient);
  assert.equal(response.body.fields.attachment1, undefined);
  assert.ok(response.body.template.attachmentGuidance);
  assert.equal(
    response.body.template.fields.find(
      (field: { id: string }) => field.id === "phone",
    ).hint,
    undefined,
  );
  assert.match(
    response.body.template.fields.find(
      (field: { id: string }) => field.id === "bik",
    ).hint,
    /9 цифр/,
  );
  assert.equal(response.body.template.references.length, 2);
  assert.deepEqual(response.body.template.paragraphs[0].controlsBefore, [
    "applicantType",
  ]);
  const exported = await createDocx(response.body.template, fields);
  assert.match(documentXml(exported), /Адресат старого документа/);
  assert.match(documentXml(exported), /w:left="1701"/);
  assert.ok(documentXml(exported).includes(fields.signerName!));
  assert.ok(
    documentXml(exported).includes(fields.date!.split("-").reverse().join(".")),
  );
  assert.doesNotMatch(
    documentXml(exported),
    /Приложения|Старое приложение|Что можно приложить к претензии/,
  );
  const updated = await api("PUT", `/api/documents/${id}`, {
    token: owner.accessToken,
    body: {
      templateId: template.id,
      templateVersion: 1,
      title: "Старый документ",
      fields: { ...fields, recipient: "Новый адресат старого документа" },
    },
  });
  assert.equal(updated.status, 200);
  const row = await pool.query(
    "SELECT template FROM saved_documents WHERE id=$1",
    [id],
  );
  assert.deepEqual(row.rows[0].template, template);
});

test("optional registration, personal rights, material carriers and license branches export selected content", async () => {
  const { accessToken } = await registerUser();
  const fields = await filled({
    rightsBasis: "exclusive",
    registered: "yes",
    personalRights: "yes",
    personalAction: "distorted",
    physicalCopies: "yes",
    disputedRights: "yes",
    violationAction: "access",
    attachment1: "Договор о предоставлении исключительной лицензии",
    pages1: "2",
    registrationNumber: "REG-2026",
    carriersAction: "destroy",
    authorName: "Автор программы",
    distortions: "Искажение модуля выгрузки",
  });
  const response = await fetch(
    apiUrl("/api/document-templates/code-claim/download"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields }),
    },
  );
  assert.equal(response.status, 200);
  const xml = documentXml(Buffer.from(await response.arrayBuffer()));
  assert.match(xml, /является исключительным лицензиатом/);
  assert.doesNotMatch(xml, /обладает исключительным правом/);
  assert.match(xml, /REG-2026/);
  assert.match(xml, /изъятия и уничтожения/);
  assert.match(xml, /восстановить указание автора Автор программы/);
  assert.match(xml, /Искажение модуля выгрузки/);
  assert.match(xml, /предоставил доступ к программному коду/);
  assert.doesNotMatch(xml, /исключительной лицензии, на 2 л\./);
  assert.doesNotMatch(xml, /\{\{|\[Дата договора|\[Номер договора/);
});

async function filled(overrides: Values = {}): Promise<Values> {
  const template = await getTemplate("code-claim");
  const fields: Values = {
    applicantType: "person",
    rightsBasis: "author",
    contract: "no",
    moneyType: "none",
    registered: "no",
    personalRights: "no",
    physicalCopies: "no",
    disputedRights: "no",
    ...overrides,
  };
  for (const field of template.fields) {
    if (
      fields[field.id] !== undefined ||
      !matches(field.when, fields) ||
      !field.required
    )
      continue;
    fields[field.id] =
      field.defaultValue ??
      (field.type === "select"
        ? field.options![0]!.value
        : field.type === "date"
          ? "2026-10-18"
          : field.type === "email"
            ? "author@example.test"
            : field.type === "number"
              ? "30"
              : field.type === "money"
                ? "15000"
                : field.id === "bik"
                  ? "044525225"
                  : ["account", "correspondent"].includes(field.id)
                    ? "40702810000000000001"
                    : `Данные: ${field.label}`);
  }
  return fields;
}

// Read an actual ZIP entry to check exported DOCX content, not just its signature.
function documentXml(zip: Buffer): string {
  for (let offset = 0; offset < zip.length - 46; offset++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) continue;
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString();
    if (name !== "word/document.xml") continue;
    const local = zip.readUInt32LE(offset + 42);
    const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const compressed = zip.subarray(start, start + size);
    return (
      zip.readUInt16LE(offset + 10) === 8
        ? inflateRawSync(compressed)
        : compressed
    ).toString("utf8");
  }
  throw new Error("word/document.xml not found");
}

test("constructor exposes one template and rejects unknown templates, missing and invalid values", async () => {
  const { accessToken: token } = await registerUser();
  for (const [method, path] of [
    ["GET", "/api/document-templates"],
    ["GET", "/api/document-templates/code-claim"],
    ["POST", "/api/document-templates/code-claim/download"],
  ]) {
    assert.equal((await api(method!, path!)).status, 401);
    assert.equal((await api(method!, path!, { token: "invalid" })).status, 401);
  }
  const list = await api("GET", "/api/document-templates", { token });
  assert.equal(list.headers.get("cache-control"), "no-store");
  assert.deepEqual(
    list.body.items.map((item: { id: string }) => item.id),
    ["code-claim"],
  );
  assert.equal(
    (await api("GET", "/api/document-templates/missing", { token })).status,
    404,
  );
  const missing = await api(
    "POST",
    "/api/document-templates/code-claim/download",
    { token, body: { fields: {} } },
  );
  assert.equal(missing.status, 400);
  assert.ok(
    missing.body.error.details.some(
      (issue: { field: string }) => issue.field === "recipient",
    ),
  );
  const invalid = await filled({
    applicantType: "company",
    rightsBasis: "author",
    moneyType: "fixed",
    fixedAmount: "9999",
    date: "2026-02-30",
  });
  const res = await api("POST", "/api/document-templates/code-claim/download", {
    token,
    body: { fields: invalid },
  });
  assert.equal(res.status, 400);
  for (const field of ["rightsBasis", "fixedAmount", "date"])
    assert.ok(
      res.body.error.details.some(
        (issue: { field: string }) => issue.field === field,
      ),
    );
});

test("exports chosen money and contract branches as real DOCX, escaping text and calculating amounts", async () => {
  const { accessToken } = await registerUser();
  for (const [moneyType, match] of [
    ["losses", "30 000"],
    ["fixed", "15 000"],
    ["copies", "30 000"],
    ["license", "30 000"],
    ["none", "Порядок ответа"],
  ] as const) {
    const fields = await filled({
      moneyType,
      applicant: "Иванов <Иван> & Партнёры",
      recipient: "ООО Адресат",
      contract: "yes",
      contractNumber: "LICENSE-17",
      contractDate: "2025-12-01",
    });
    const response = await fetch(
      apiUrl("/api/document-templates/code-claim/download"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fields }),
      },
    );
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("content-type")!, /wordprocessingml/);
    const xml = documentXml(Buffer.from(await response.arrayBuffer()));
    assert.ok(xml.includes(match), moneyType);
    assert.match(xml, /Иванов &lt;Иван&gt; &amp; Партнёры/);
    assert.match(xml, /LICENSE-17/);
    assert.doesNotMatch(xml, /договор, допускающий такое использование/);
    assert.doesNotMatch(xml, /\{\{|ВАРИАНТ [АБВГ]|\[Правообладатель\]/);
    if (moneyType !== "fixed")
      assert.doesNotMatch(xml, /подпункта 1 пункта 1 статьи 1301/);
    if (moneyType === "none")
      assert.doesNotMatch(
        xml,
        /V\. Денежное требование|ИНН получателя|срок выплаты/,
      );
  }
});

test("saved documents require authentication, are idempotent and isolated between accounts", async () => {
  const owner = await registerUser();
  const stranger = await registerUser();
  const id = randomUUID();
  const body = {
    templateId: "code-claim",
    templateVersion: 3,
    title: "Претензия к адресату",
    fields: { recipient: "Мой адресат" },
  };
  assert.equal((await api("GET", "/api/documents")).status, 401);
  assert.equal(
    (await api("PUT", `/api/documents/${id}`, { body })).status,
    401,
  );
  const first = await api("PUT", `/api/documents/${id}`, {
    token: owner.accessToken,
    body,
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.complete, false);
  assert.equal(first.body.template.version, 3);
  // Existing v2 favorites may still contain the old repetitive explanations.
  const staleSnapshot = structuredClone(first.body.template);
  staleSnapshot.fields.find(
    (field: { id: string }) => field.id === "phone",
  ).hint = "Введите телефон.";
  staleSnapshot.references = [];
  await pool.query("UPDATE saved_documents SET template=$1 WHERE id=$2", [
    JSON.stringify(staleSnapshot),
    id,
  ]);
  const reopened = await api("GET", `/api/documents/${id}`, {
    token: owner.accessToken,
  });
  assert.equal(
    reopened.body.template.fields.find(
      (field: { id: string }) => field.id === "phone",
    ).hint,
    undefined,
  );
  assert.equal(reopened.body.template.references.length, 2);
  assert.equal(
    (
      await api("PUT", `/api/documents/${id}`, {
        token: owner.accessToken,
        body,
      })
    ).status,
    200,
  );
  assert.equal(
    (await api("GET", "/api/documents", { token: owner.accessToken })).body
      .items.length,
    1,
  );
  assert.equal(
    (await api("GET", `/api/documents/${id}`, { token: stranger.accessToken }))
      .status,
    404,
  );
  assert.equal(
    (
      await api("PUT", `/api/documents/${id}`, {
        token: stranger.accessToken,
        body,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await api("POST", `/api/documents/${id}/download`, {
        token: stranger.accessToken,
        body: { fields: await filled() },
      })
    ).status,
    404,
  );
  await api("DELETE", `/api/documents/${id}`, { token: stranger.accessToken });
  assert.equal(
    (await api("GET", `/api/documents/${id}`, { token: owner.accessToken }))
      .body.fields.recipient,
    "Мой адресат",
  );
  const updated = await api("PUT", `/api/documents/${id}`, {
    token: owner.accessToken,
    body: {
      ...body,
      fields: await filled({
        recipient: "Новый адресат",
        moneyType: "none",
        fixedAmount: "999999",
        personalAction: "removed",
      }),
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.complete, true);
  assert.equal(updated.body.fields.fixedAmount, undefined);
  assert.equal(updated.body.fields.personalAction, undefined);
  assert.equal(
    (
      await api("PUT", `/api/documents/${id}`, {
        token: owner.accessToken,
        body: { ...body, templateVersion: 99 },
      })
    ).status,
    409,
  );
  const download = await fetch(apiUrl(`/api/documents/${id}/download`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${owner.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: updated.body.fields }),
  });
  assert.equal(download.status, 200);
  assert.match(
    documentXml(Buffer.from(await download.arrayBuffer())),
    /Новый адресат/,
  );
  assert.equal(
    (await api("DELETE", `/api/documents/${id}`, { token: owner.accessToken }))
      .status,
    204,
  );
  assert.equal(
    (await api("GET", `/api/documents/${id}`, { token: owner.accessToken }))
      .status,
    404,
  );
});

test("general ownership checklist has no topic, remains searchable and can be saved", async () => {
  const material = await api("GET", "/api/materials/ownership-overview");
  assert.equal(material.status, 200);
  assert.equal(material.body.topic, null);
  assert.equal(material.body.sections.length, 5);
  const user = await registerUser();
  assert.equal(
    (
      await api("PUT", "/api/favorites/ownership-overview", {
        token: user.accessToken,
      })
    ).status,
    204,
  );
  assert.equal(
    (await api("GET", "/api/favorites", { token: user.accessToken })).body
      .items[0].material.id,
    "ownership-overview",
  );
});
