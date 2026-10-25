export type User = { id: string; name: string; email: string; role: string };
export type Area = { id: string; label: string; group: string };
export type Vehicle = {
  id: string;
  make: string;
  model: string;
  generation: string;
  year_from: number;
  year_to: number;
  facelift: string;
  variant: string;
  market: string;
  supported?: number;
};
export type Photo = {
  id: string;
  note: string;
  sort_order: number;
  areas: string[];
};
export type Marker = {
  id: string;
  label: string;
  damage: boolean;
  position: [number, number, number];
  asset_id: string;
};
export type Asset = {
  id: string;
  catalog_id: string;
  version: number;
  creator: string;
  license: string;
  attribution: string;
  limitations: string;
  source_url: string;
  size: number;
  approved: boolean;
  config: {
    scale: number;
    rotation: [number, number, number];
    target: [number, number, number];
    hotspots: {
      area: string;
      position: [number, number, number];
      normal: [number, number, number];
    }[];
    meshes?: Record<string, string>;
    cameras?: Record<string, [number, number, number]>;
  };
};
export type Listing = {
  id: string;
  catalog_id: string;
  asset_id: string | null;
  title: string;
  year: number;
  price: number;
  mileage: number;
  city: string;
  description: string;
  status: string;
  demo: number;
  vehicle: Vehicle;
  photos: Photo[];
  markers: Marker[];
  asset: Asset | null;
  spin: { ids: string[]; confirmed: boolean; loop: boolean };
  unavailable: string[];
  coverage: number;
  recommended: number;
};
