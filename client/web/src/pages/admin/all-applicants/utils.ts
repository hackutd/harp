export function getStatusColor(status: string): string {
  switch (status) {
    case 'accepted':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'waitlisted':
      return 'bg-yellow-100 text-yellow-800';
    case 'submitted':
      return 'bg-blue-100 text-blue-800';
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function formatName(firstName: string | null, lastName: string | null): string {
  if (!firstName && !lastName) return '-';
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}
