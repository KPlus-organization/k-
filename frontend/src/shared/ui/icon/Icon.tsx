import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Calculator,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileCheck2,
  Files,
  History,
  Info,
  LockKeyhole,
  LogOut,
  Menu,
  MessagesSquare,
  ScanLine,
  Search,
  SearchCheck,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

const icons = {
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUp: ArrowUpRight,
  book: BookOpen,
  bookmark: Bookmark,
  calculator: Calculator,
  check: Check,
  chevron: ChevronRight,
  clock: Clock3,
  eye: Eye,
  eyeOff: EyeOff,
  file: FileCheck2,
  files: Files,
  history: History,
  info: Info,
  lock: LockKeyhole,
  logout: LogOut,
  menu: Menu,
  messages: MessagesSquare,
  scan: ScanLine,
  search: Search,
  searchCheck: SearchCheck,
  settings: Settings,
  shield: ShieldCheck,
  user: UserRound,
  close: X,
};
export type IconName = keyof typeof icons;
export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Component = icons[name];
  return <Component size={size} strokeWidth={1.8} aria-hidden="true" className={className} />;
}
