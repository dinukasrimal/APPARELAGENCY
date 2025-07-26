import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, DollarSign, MapPin, Calendar, FileText } from 'lucide-react';
import { Collection } from '@/types/collections';

interface CollectionDetailsProps {
  collection: Collection;
  onBack: () => void;
}

export const CollectionDetails: React.FC<CollectionDetailsProps> = ({
  collection,
  onBack
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      allocated: { label: 'Allocated', variant: 'default' as const },
      completed: { label: 'Completed', variant: 'default' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collections
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Collection Details</h2>
          <p className="text-gray-600">Collection #{collection.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Collection Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-sm text-gray-700">Collection ID:</span>
                <p className="text-sm">{collection.id}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Status:</span>
                <div className="mt-1">{getStatusBadge(collection.status)}</div>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Customer:</span>
                <p className="text-sm">{collection.customerName}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Payment Method:</span>
                <p className="text-sm capitalize">{collection.paymentMethod}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Total Amount:</span>
                <p className="text-lg font-bold text-green-600">LKR {collection.totalAmount.toLocaleString()}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Created:</span>
                <p className="text-sm">{formatDate(collection.createdAt)}</p>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-3">Payment Breakdown</h4>
              <div className="space-y-2">
                {collection.cashAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Cash Amount:</span>
                    <span className="text-sm font-medium">LKR {collection.cashAmount.toLocaleString()}</span>
                  </div>
                )}
                {collection.chequeAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Cheque Amount:</span>
                    <span className="text-sm font-medium">LKR {collection.chequeAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cheque Details */}
            {collection.chequeDetails.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm text-gray-700 mb-3">Cheque Details</h4>
                <div className="space-y-2">
                  {collection.chequeDetails.map((cheque, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{cheque.chequeNumber}</p>
                          <p className="text-xs text-gray-600">{cheque.bankName}</p>
                          <p className="text-xs text-gray-600">
                            Date: {cheque.chequeDate.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">LKR {cheque.amount.toLocaleString()}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {cheque.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {collection.notes && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm text-gray-700 mb-2">Notes</h4>
                <p className="text-sm text-gray-600">{collection.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location and Additional Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Additional Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* GPS Coordinates */}
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">GPS Coordinates</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Latitude</span>
                  <p className="text-sm font-mono">{collection.gpsCoordinates.latitude.toFixed(6)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Longitude</span>
                  <p className="text-sm font-mono">{collection.gpsCoordinates.longitude.toFixed(6)}</p>
                </div>
              </div>
            </div>

            {/* Map Link */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `https://www.google.com/maps?q=${collection.gpsCoordinates.latitude},${collection.gpsCoordinates.longitude}`;
                  window.open(url, '_blank');
                }}
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                View on Google Maps
              </Button>
            </div>

            {/* Additional Details */}
            <div className="border-t pt-4 space-y-3">
              <div>
                <span className="font-medium text-sm text-gray-700">Agency ID:</span>
                <p className="text-sm">{collection.agencyId}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Created By:</span>
                <p className="text-sm">{collection.createdBy}</p>
              </div>
              <div>
                <span className="font-medium text-sm text-gray-700">Cash Date:</span>
                <p className="text-sm">{collection.cashDate.toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 