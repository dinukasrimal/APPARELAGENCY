
export interface Customer {
  id: string;
  name: string;
  phone: string;
  secondaryPhone?: string; // Optional secondary phone number
  address: string;
  storefrontPhoto?: string;
  signature?: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  agencyId: string;
  createdAt: Date;
  createdBy: string;
  shopOwnerName?: string;
  shopOwnerBirthday?: string; // ISO date string (YYYY-MM-DD)
}
