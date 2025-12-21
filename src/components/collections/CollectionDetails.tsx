import React, { useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, DollarSign, MapPin, Calendar, FileText, CreditCard, Building, Printer, Share2 } from 'lucide-react';
import { Collection } from '@/types/collections';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';

interface CollectionDetailsProps {
  collection: Collection;
  onBack: () => void;
}

export const CollectionDetails: React.FC<CollectionDetailsProps> = ({
  collection,
  onBack
}) => {
  const printableRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

  const receiptCheques = useMemo(() => collection.chequeDetails || [], [collection.chequeDetails]);

  const buildPdfFromReceipt = async () => {
    const printableContent = printableRef.current;
    if (!printableContent) {
      throw new Error('Receipt layout not ready. Please try again.');
    }

    const [jspdfModule, html2canvas] = await Promise.all([
      import(/* @vite-ignore */ 'jspdf'),
      import(/* @vite-ignore */ 'html2canvas').then((m) => (m as any).default ? (m as any).default : (m as any))
    ]);
    const JsPDF: any = (jspdfModule as any).default || (jspdfModule as any).jsPDF;

    const canvas = await (html2canvas as any)(printableContent, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: printableContent.scrollWidth,
      windowHeight: printableContent.scrollHeight
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new JsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    return pdf;
  };

  const handleShareReceipt = async () => {
    try {
      const pdf = await buildPdfFromReceipt();
      const filename = `collection-${collection.id}.pdf`;
      const dataUri = pdf.output('datauristring') as string;
      const base64 = dataUri.split(',')[1];

      if (Capacitor.getPlatform() !== 'web') {
        const { Filesystem, Directory } = await import(/* @vite-ignore */ '@capacitor/filesystem');
        const { Share } = await import(/* @vite-ignore */ '@capacitor/share');

        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: `Collection ${collection.id}`,
          text: `Receipt for ${collection.customerName} - LKR ${collection.totalAmount.toLocaleString()}`,
          files: [writeResult.uri],
          dialogTitle: 'Share Collection Receipt',
        });
        toast({ title: 'Shared', description: 'Receipt is ready to share (e.g., WhatsApp).' });
        return;
      }

      const link = document.createElement('a');
      link.href = dataUri;
      link.download = filename;
      link.click();
      toast({ title: 'Downloaded', description: 'Receipt PDF downloaded.' });
    } catch (error) {
      console.error('Failed to share receipt', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate receipt PDF',
        variant: 'destructive',
      });
    }
  };

  const handlePrintReceipt = async () => {
    try {
      const pdf = await buildPdfFromReceipt();
      const filename = `collection-${collection.id}.pdf`;

      if (Capacitor.getPlatform() === 'web') {
        pdf.save(filename);
        toast({ title: 'Downloaded', description: 'Receipt PDF downloaded.' });
        return;
      }

      const dataUri = pdf.output('datauristring') as string;
      const base64 = dataUri.split(',')[1];
      const { Filesystem, Directory } = await import(/* @vite-ignore */ '@capacitor/filesystem');

      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
      });

      toast({ title: 'Saved', description: 'Receipt PDF saved. You can print/share from your files.' });
    } catch (error) {
      console.error('Failed to print receipt', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create printable receipt',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-8 min-h-screen lg:min-h-0 overflow-y-auto">
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
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
            <Printer className="h-4 w-4 mr-1" />
            Print / Save PDF
          </Button>
          <Button size="sm" onClick={handleShareReceipt}>
            <Share2 className="h-4 w-4 mr-1" />
            Share Receipt
          </Button>
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
            {collection.chequeDetails && collection.chequeDetails.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cheque Details ({collection.chequeDetails.length})
                </h4>
                <div className="space-y-3">
                  {collection.chequeDetails.map((cheque, index) => (
                    <Card key={cheque.id || index} className="border-l-4 border-l-blue-400">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-gray-900">Cheque #{cheque.chequeNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">{cheque.bankName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                Date: {cheque.chequeDate.toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long', 
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                            {cheque.clearedAt && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-600">
                                  Cleared: {cheque.clearedAt.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long', 
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}
                            {cheque.returnedAt && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-red-500" />
                                <span className="text-sm text-red-600">
                                  Returned: {cheque.returnedAt.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long', 
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}
                            {cheque.returnReason && (
                              <div className="flex items-start gap-2">
                                <FileText className="h-4 w-4 text-red-500 mt-0.5" />
                                <span className="text-sm text-red-600">
                                  Return Reason: {cheque.returnReason}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="text-right md:text-left">
                              <p className="text-xs text-gray-500 mb-1">Amount</p>
                              <p className="text-xl font-bold text-green-600">LKR {cheque.amount.toLocaleString()}</p>
                            </div>
                            <div className="flex justify-end md:justify-start">
                              <Badge 
                                variant={cheque.status === 'cleared' ? 'default' : 
                                        cheque.status === 'returned' ? 'destructive' : 'secondary'}
                                className="capitalize"
                              >
                                {cheque.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Show message if no cheques */}
            {collection.paymentMethod === 'mixed' && (!collection.chequeDetails || collection.chequeDetails.length === 0) && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cheque Details
                </h4>
                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No cheque details available</p>
                </div>
              </div>
            )}

            {/* Notes */}
            {collection.notes && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{collection.notes}</p>
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

      {/* Hidden printable receipt */}
      <div
        ref={printableRef}
        className="print-container"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '210mm',
          background: '#ffffff',
          color: '#111827',
          padding: '16px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '1.4'
        }}
      >
        <div style={{ borderBottom: '2px solid #111827', paddingBottom: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>Collection Receipt</div>
              <div style={{ fontSize: '12px', color: '#4b5563' }}>Collection ID: {collection.id}</div>
            </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#4b5563' }}>
              <div>{formatDate(collection.createdAt)}</div>
              <div>Agency: {collection.agencyName || collection.agencyId}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Customer</div>
              <div style={{ fontWeight: 600 }}>{collection.customerName}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Collected By</div>
              <div style={{ fontWeight: 600 }}>{collection.createdBy}</div>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Payment Method</div>
              <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{collection.paymentMethod}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Amount</div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>LKR {collection.totalAmount.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {collection.cashAmount > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Cash</div>
                <div style={{ fontWeight: 600 }}>LKR {collection.cashAmount.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Cash Date: {collection.cashDate.toLocaleDateString()}</div>
              </div>
            )}
            {collection.chequeAmount > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Cheques</div>
                <div style={{ fontWeight: 600 }}>LKR {collection.chequeAmount.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        {receiptCheques.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Cheque Details</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px', border: '1px solid #e5e7eb' }}>Cheque #</th>
                  <th style={{ textAlign: 'left', padding: '6px', border: '1px solid #e5e7eb' }}>Bank</th>
                  <th style={{ textAlign: 'left', padding: '6px', border: '1px solid #e5e7eb' }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '6px', border: '1px solid #e5e7eb' }}>Amount</th>
                  <th style={{ textAlign: 'left', padding: '6px', border: '1px solid #e5e7eb' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {receiptCheques.map((cheque) => (
                  <tr key={cheque.id}>
                    <td style={{ padding: '6px', border: '1px solid #e5e7eb' }}>{cheque.chequeNumber}</td>
                    <td style={{ padding: '6px', border: '1px solid #e5e7eb' }}>{cheque.bankName}</td>
                    <td style={{ padding: '6px', border: '1px solid #e5e7eb' }}>{cheque.chequeDate.toLocaleDateString()}</td>
                    <td style={{ padding: '6px', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                      LKR {cheque.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #e5e7eb', textTransform: 'capitalize' }}>
                      {cheque.status.replace('_', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px', fontSize: '11px', color: '#4b5563' }}>
          <div>GPS: {collection.gpsCoordinates.latitude.toFixed(6)}, {collection.gpsCoordinates.longitude.toFixed(6)}</div>
          {collection.notes && <div style={{ marginTop: '4px' }}>Notes: {collection.notes}</div>}
          <div style={{ marginTop: '6px', color: '#6b7280' }}>Thank you for your payment.</div>
        </div>
      </div>
    </div>
  );
}; 
