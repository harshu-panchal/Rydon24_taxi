import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNavbar from '../components/BottomNavbar';
import ActivityHeader from '../components/activity/ActivityHeader';
import ActivityTabs from '../components/activity/ActivityTabs';
import ActivityCard from '../components/activity/ActivityCard';
import ActivityPager from '../components/activity/ActivityPager';
import {
  ActivityEmptyState,
  ActivityErrorState,
  ActivityLoadingState,
  ActivitySupportState,
} from '../components/activity/ActivityStates';
import api from '../../../shared/api/axiosInstance';
import { normalizeRide, PAGE_SIZE, TABS } from '../components/activity/activityHelpers';

const Activity = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/taxi/user') ? '/taxi/user' : '';

  useEffect(() => {
    let active = true;

    const loadRideHistory = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/rides', {
          params: {
            limit: PAGE_SIZE,
            page: currentPage,
          },
        });
        const payload = response?.data || response || {};

        const rides = payload?.results || payload?.data?.results || [];
        const nextPagination = payload?.pagination || payload?.data?.pagination || null;

        if (!active) {
          return;
        }

        setActivities(rides.map(normalizeRide).filter((ride) => ride.id));
        setPagination(nextPagination || {
          page: currentPage,
          limit: PAGE_SIZE,
          total: rides.length,
          totalPages: Math.max(1, Math.ceil(rides.length / PAGE_SIZE)),
          hasNextPage: false,
          hasPrevPage: currentPage > 1,
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError?.message || 'Could not load your ride history.');
        setActivities([]);
        setPagination({
          page: 1,
          limit: PAGE_SIZE,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRideHistory();

    return () => {
      active = false;
    };
  }, [currentPage, reloadKey]);

  const filtered = useMemo(() => {
    return activities.filter((activity) => {
      if (activeTab === 'All') return true;
      if (activeTab === 'Rides') return activity.type === 'ride';
      if (activeTab === 'Parcels') return activity.type === 'parcel';
      return false;
    });
  }, [activeTab, activities]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const handleItemClick = (item) => {
    if (item.type === 'parcel') {
      navigate(`${routePrefix}/parcel/detail/${item.id}`);
    } else {
      navigate(`${routePrefix}/ride/detail/${item.id}`, { state: { ride: item.ride } });
    }
  };

  const helperText = activeTab === 'Support' ? 'Tickets and help requests' : 'Your recent trips and deliveries';

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-slate-50 font-sans pb-28">
      <ActivityHeader helperText={helperText} onBack={() => navigate(-1)} />
      <ActivityTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex-1 px-4 py-4">
        {activeTab === 'Support' ? (
          <ActivitySupportState onContact={() => navigate('/support')} />
        ) : loading ? (
          <ActivityLoadingState />
        ) : error ? (
          <ActivityErrorState error={error} onRetry={() => setReloadKey((current) => current + 1)} />
        ) : filtered.length === 0 ? (
          <ActivityEmptyState activeTab={activeTab} />
        ) : (
          <div className="space-y-3 pb-2">
            {filtered.map((activity) => (
              <ActivityCard key={activity.id} {...activity} onClick={() => handleItemClick(activity)} />
            ))}
            <ActivityPager
              pagination={pagination}
              onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
              onNext={() => setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))}
            />
          </div>
        )}
      </div>

      <BottomNavbar />
    </div>
  );
};

export default Activity;
