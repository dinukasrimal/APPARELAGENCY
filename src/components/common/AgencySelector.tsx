import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, Users } from 'lucide-react';
import { useAgencies } from '@/hooks/useAgency';
import { User } from '@/types/auth';

interface AgencySelectorProps {
  user: User;
  selectedAgencyId: string | null;
  onAgencyChange: (agencyId: string | null) => void;
  placeholder?: string;
  showAllOption?: boolean;
  disabled?: boolean;
}

const AgencySelector = ({ 
  user,
  selectedAgencyId, 
  onAgencyChange, 
  placeholder = "Select an agency...",
  showAllOption = true,
  disabled = false 
}: AgencySelectorProps) => {
  const { agencies, loading } = useAgencies();
  const [selectedAgencyName, setSelectedAgencyName] = useState<string>('');

  // Only show agency selector for superusers
  if (!user || user.role !== 'superuser') {
    return null;
  }

  useEffect(() => {
    if (selectedAgencyId) {
      const agency = agencies.find(a => a.id === selectedAgencyId);
      setSelectedAgencyName(agency?.name || '');
    } else {
      setSelectedAgencyName('');
    }
  }, [selectedAgencyId, agencies]);

  const handleValueChange = (value: string) => {
    if (value === 'all') {
      onAgencyChange(null);
    } else {
      onAgencyChange(value);
    }
  };

  const getCurrentValue = () => {
    if (!selectedAgencyId) return 'all';
    return selectedAgencyId;
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-blue-600" />
        <span className="text-sm font-medium text-blue-900">View Agency Data:</span>
      </div>
      
      <Select 
        value={getCurrentValue()} 
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger className="w-64 bg-white">
          <SelectValue placeholder={loading ? "Loading agencies..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>All Agencies</span>
              </div>
            </SelectItem>
          )}
          {agencies.map((agency) => (
            <SelectItem key={agency.id} value={agency.id}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>{agency.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedAgencyName && (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
          {selectedAgencyName}
        </Badge>
      )}
      
      {!selectedAgencyId && showAllOption && (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">
          All Agencies
        </Badge>
      )}
    </div>
  );
};

export default AgencySelector;