import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, PencilLine, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';

let driverNeededDocumentsInFlight = null;

const fetchDriverNeededDocumentsOnce = async () => {
  if (!driverNeededDocumentsInFlight) {
    driverNeededDocumentsInFlight = adminService
      .getDriverNeededDocuments()
      .finally(() => {
        driverNeededDocumentsInFlight = null;
      });
  }

  return driverNeededDocumentsInFlight;
};

const GlobalDocuments = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');

  const loadDocuments = async ({ dedupe = false } = {}) => {
    setIsLoading(true);
    setError('');

    try {
      const response = dedupe
        ? await fetchDriverNeededDocumentsOnce()
        : await adminService.getDriverNeededDocuments();
      const results = response?.data?.data?.results || response?.data?.results || [];
      setDocuments(Array.isArray(results) ? results : []);
    } catch (err) {
      setError(err?.message || 'Unable to load driver needed documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments({ dedupe: true });
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this driver needed document?')) {
      return;
    }

    try {
      await adminService.deleteDriverNeededDocument(id);
      await loadDocuments();
    } catch (err) {
      alert(err?.message || 'Unable to delete document');
    }
  };

  const handleToggleStatus = async (document) => {
    try {
      await adminService.updateDriverNeededDocument(document.id || document._id, {
        active: !document.active,
      });

      setDocuments((current) =>
        current.map((item) =>
          String(item.id || item._id) === String(document.id || document._id)
            ? { ...item, active: !document.active }
            : item,
        ),
      );
    } catch (err) {
      alert(err?.message || 'Unable to update status');
    }
  };

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return documents;
    }

    return documents.filter((document) =>
      [document.name, document.account_type, document.image_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [documents, searchTerm]);

  const paginatedDocuments = filteredDocuments.slice(0, Number(pageSize));

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
          <span>Masters</span>
          <ChevronRight size={12} />
          <span className="text-gray-700">Driver Needed Documents</span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Driver Needed Documents</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage driver onboarding document requirements from one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/drivers/documents/create')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Plus size={16} />
            Add Driver Needed Documents
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Filter documents..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Account Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Image Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-sm text-gray-500">
                    Loading documents...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-sm text-rose-500">
                    {error}
                  </td>
                </tr>
              ) : paginatedDocuments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-sm text-gray-500">
                    No driver documents configured yet.
                  </td>
                </tr>
              ) : (
                paginatedDocuments.map((document) => (
                  <tr key={document.id || document._id} className="hover:bg-gray-50/70">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{document.name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 capitalize">{document.account_type || 'individual'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {String(document.image_type || 'image').replace('_', ' & ')}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(document)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          document.active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {document.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/drivers/documents/edit/${document.id || document._id}`)}
                          className="rounded-lg border border-gray-200 p-2 text-amber-600 transition-colors hover:bg-amber-50"
                        >
                          <PencilLine size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(document.id || document._id)}
                          className="rounded-lg border border-gray-200 p-2 text-rose-600 transition-colors hover:bg-rose-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm text-gray-500">
          <span>
            Showing 1 to {paginatedDocuments.length} of {filteredDocuments.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button type="button" disabled className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400">
              Prev
            </button>
            <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white">
              1
            </button>
            <button type="button" disabled className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalDocuments;
