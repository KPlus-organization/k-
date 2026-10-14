import { useParams } from 'react-router-dom';
import type { Open } from '@/shared/lib';
import { objectJourney, type MaterialArea } from '@/entities/material';
import { MaterialPage } from '@/pages/material';
import { ObjectMaterialsPage } from '@/pages/object-materials';

export function ObjectJourneyRoute({
  area,
  open,
  favorites,
  toggleFavorite,
}: {
  area: MaterialArea;
  open: Open;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}) {
  const { objectId = '' } = useParams();
  const { primary } = objectJourney(objectId, area);
  return primary ? (
    <MaterialPage
      materialId={primary}
      journeyArea={area}
      open={open}
      favorites={favorites}
      toggleFavorite={toggleFavorite}
    />
  ) : (
    <ObjectMaterialsPage topic={objectId} area={area} open={open} />
  );
}
