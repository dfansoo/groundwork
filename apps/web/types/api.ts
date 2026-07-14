export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  details?: unknown;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export interface CatalogImageRef {
  fileId: string;
  url: string;
}

export interface PublicTourView {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationHrs: number;
  pickupTimes: string[];
  pickupLocations: string[];
  images: CatalogImageRef[];
  priceMinor: number;
  currency: string;
}

export interface PublicHotelView {
  id: string;
  slug: string;
  name: string;
  starRating: number;
  location: string;
  amenities: string[];
  images: CatalogImageRef[];
  rooms: { id: string; name: string }[];
}

export interface PublicPackageCardView {
  id: string;
  slug: string;
  title: string;
  description: string;
  images: CatalogImageRef[];
  durationDays: number;
  fromPricePerPersonMinor: number;
  currency: string;
}

export interface PublicItineraryDay {
  dayNumber: number;
  tour: { id: string; slug: string | null; title: string; durationHrs: number } | null;
  hotel: { id: string; slug: string | null; name: string; starRating: number; location: string } | null;
  roomTypeName: string | null;
  guideIncluded: boolean;
}

export interface PublicPackageDetailView extends PublicPackageCardView {
  itinerary: PublicItineraryDay[];
}

export interface PublicTourDetailView extends PublicTourView {
  blackoutDates: string[];
  /** How the price scales with the group — lets the booking page show a live total. */
  pricingMode: "PER_PERSON" | "PER_VEHICLE";
  vehicleCapacity: number;
}

export interface CatalogListParams {
  search?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
  currency?: string;
}

export interface QuoteRequest {
  packageId: string;
  startDate: string; // ISO date, YYYY-MM-DD
  groupSize: number;
  occupancy: "SINGLE" | "DOUBLE" | "TRIPLE";
  currency?: string;
}

export interface QuoteBreakdown {
  subtotalMinor: number;
  seasonAdjustmentMinor: number;
  groupAdjustmentMinor: number;
  totalMinor: number;
  perPersonMinor: number;
  currency: string;
}

export interface QuoteResult {
  packageId: string;
  groupSize: number;
  occupancy: "SINGLE" | "DOUBLE" | "TRIPLE";
  nights: number;
  roomsNeeded: number;
  breakdown: QuoteBreakdown;
  displayCurrency: string;
  displayTotalMinor: number;
  displayPerPersonMinor: number;
}
