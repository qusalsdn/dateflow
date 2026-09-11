export type Place = {
  id: string;
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  url: string;
};

export type PlaceSearchResult = {
  places: Place[];
  nextPage: number | null;
};
