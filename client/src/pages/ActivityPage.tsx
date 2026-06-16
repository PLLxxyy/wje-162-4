import { useState, useEffect } from 'react';
import { api } from '../api';
import { Activity, ACTIVITY_STATUS_MAP } from '../types';

type FilterStatus = 'all' | 'pending' | 'ongoing' | 'completed' | 'cancelled';

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [myRegistrations, setMyRegistrations] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [actData, myData] = await Promise.all([
        api.getActivities(),
        api.getMyActivities(),
      ]);
      setActivities(actData.activities as Activity[]);
      const regMap = new Map<number, string>();
      myData.registrations.forEach((r: any) => {
        regMap.set(r.activity_id, r.status);
      });
      setMyRegistrations(regMap);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRegister = async (activityId: number) => {
    try {
      await api.registerActivity(activityId);
      showToast('success', '报名成功');
      loadData();
    } catch (err: any) {
      showToast('error', err.message || '报名失败');
    }
  };

  const handleCancelRegister = async (activityId: number) => {
    if (!confirm('确定要取消报名吗？')) return;
    try {
      await api.cancelRegisterActivity(activityId);
      showToast('success', '已取消报名');
      loadData();
    } catch (err: any) {
      showToast('error', err.message || '取消失败');
    }
  };

  const formatDateTime = (dt: string) => {
    return dt.replace('T', ' ').substring(0, 16);
  };

  const filteredActivities = filter === 'all'
    ? activities
    : activities.filter(a => a.status === filter);

  const groupedActivities = {
    ongoing: filteredActivities.filter(a => a.status === 'ongoing'),
    pending: filteredActivities.filter(a => a.status === 'pending'),
    completed: filteredActivities.filter(a => a.status === 'completed'),
    cancelled: filteredActivities.filter(a => a.status === 'cancelled'),
  };

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'ongoing', label: '进行中' },
    { key: 'pending', label: '待开始' },
    { key: 'completed', label: '已结束' },
  ];

  const renderActivityCard = (activity: Activity) => {
    const myStatus = myRegistrations.get(activity.id);
    const isFull = activity.max_participants > 0 && (activity.registered_count || 0) >= activity.max_participants;
    const canRegister = !myStatus && activity.status !== 'cancelled' && activity.status !== 'completed' && !isFull;
    const canCancel = myStatus && myStatus !== 'completed' && myStatus !== 'rejected';

    const statusInfo = ACTIVITY_STATUS_MAP[activity.status];

    return (
      <div key={activity.id} className="activity-card">
        <div className="activity-header">
          <h3 className="activity-title">{activity.title}</h3>
          <span
            className="activity-status"
            style={{ background: statusInfo.color + '20', color: statusInfo.color }}
          >
            {statusInfo.name}
          </span>
        </div>
        <div className="activity-info">
          <div className="info-row">
            <span className="info-icon">📍</span>
            <span className="info-label">活动地点：</span>
            <span>{activity.location}</span>
          </div>
          <div className="info-row">
            <span className="info-icon">🕐</span>
            <span className="info-label">开始时间：</span>
            <span>{formatDateTime(activity.start_time)}</span>
          </div>
          <div className="info-row">
            <span className="info-icon">🕑</span>
            <span className="info-label">结束时间：</span>
            <span>{formatDateTime(activity.end_time)}</span>
          </div>
          <div className="info-row">
            <span className="info-icon">🎁</span>
            <span className="info-label">积分奖励：</span>
            <span style={{ color: '#e67e22', fontWeight: 600 }}>{activity.points_reward} 积分</span>
          </div>
          <div className="info-row">
            <span className="info-icon">👥</span>
            <span className="info-label">报名人数：</span>
            <span>
              {activity.registered_count || 0}
              {activity.max_participants > 0 ? ` / ${activity.max_participants} 人` : ' 人'}
            </span>
          </div>
        </div>
        <p className="activity-desc">{activity.description}</p>
        <div className="activity-footer">
          {myStatus && (
            <span
              className="reg-status"
              style={{
                background: myStatus === 'completed' ? '#e3f2fd' :
                  myStatus === 'approved' ? '#e8f5e9' :
                    myStatus === 'rejected' ? '#fce4ec' : '#fff3e0',
                color: myStatus === 'completed' ? '#1976d2' :
                  myStatus === 'approved' ? '#2d8a4e' :
                    myStatus === 'rejected' ? '#c62828' : '#e65100',
              }}
            >
              {myStatus === 'registered' ? '待审核' :
                myStatus === 'approved' ? '已通过' :
                  myStatus === 'rejected' ? '已拒绝' : '已完成'}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {canRegister && (
              <button className="btn-primary btn-small" onClick={() => handleRegister(activity.id)}>
                立即报名
              </button>
            )}
            {canCancel && (
              <button className="btn-secondary btn-small" onClick={() => handleCancelRegister(activity.id)}>
                取消报名
              </button>
            )}
            {isFull && !myStatus && (
              <span className="tag" style={{ background: '#f5f5f5', color: '#999' }}>名额已满</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, list: Activity[], icon: string) => {
    if (list.length === 0) return null;
    return (
      <div key={title} style={{ marginBottom: 24 }}>
        <h2 className="section-title">
          <span>{icon}</span>
          {title}
          <span className="section-count">{list.length}</span>
        </h2>
        <div className="activity-list">
          {list.map(renderActivityCard)}
        </div>
      </div>
    );
  };

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="filter-bar">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>加载中...</div>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <p>暂无活动</p>
          </div>
        </div>
      ) : (
        <>
          {filter === 'all' ? (
            <>
              {renderSection('进行中', groupedActivities.ongoing, '🔥')}
              {renderSection('待开始', groupedActivities.pending, '⏰')}
              {renderSection('已结束', groupedActivities.completed, '✅')}
              {renderSection('已取消', groupedActivities.cancelled, '❌')}
            </>
          ) : (
            <div className="activity-list">
              {filteredActivities.map(renderActivityCard)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
