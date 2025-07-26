
export interface Customer {
  id: string;
  name: string;
  phone: string;
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
}
