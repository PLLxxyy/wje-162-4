import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { Activity, ActivityRegistration, ActivityWithStats } from '../types';

const router = Router();

function getLocalDateTime(): string {
  const d = new Date();
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

router.get('/', authMiddleware, (_req: Request, res: Response) => {
  const activities = db.prepare(`
    SELECT a.*, 
           (SELECT COUNT(*) FROM activity_registrations r WHERE r.activity_id = a.id) as registered_count
    FROM activities a
    ORDER BY a.created_at DESC
  `).all() as ActivityWithStats[];
  
  res.json({ activities });
});

router.get('/my', authMiddleware, (req: Request, res: Response) => {
  const userId = req.user!.userId;
  
  const registrations = db.prepare(`
    SELECT r.*, a.title, a.description, a.location, a.start_time, a.end_time, 
           a.points_reward, a.max_participants, a.status as activity_status
    FROM activity_registrations r
    LEFT JOIN activities a ON r.activity_id = a.id
    WHERE r.user_id = ?
    ORDER BY r.registered_at DESC
  `).all(userId) as (ActivityRegistration & { title: string; activity_status: string })[];
  
  res.json({ registrations });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  
  const activity = db.prepare(`
    SELECT a.*, 
           (SELECT COUNT(*) FROM activity_registrations r WHERE r.activity_id = a.id) as registered_count
    FROM activities a
    WHERE a.id = ?
  `).get(id) as ActivityWithStats;
  
  if (!activity) {
    res.status(404).json({ error: '活动不存在' });
    return;
  }
  
  res.json({ activity });
});

router.get('/:id/registrations', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  
  const registrations = db.prepare(`
    SELECT r.*, u.nickname as user_nickname
    FROM activity_registrations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.activity_id = ?
    ORDER BY r.registered_at DESC
  `).all(id) as (ActivityRegistration & { user_nickname: string })[];
  
  res.json({ registrations });
});

router.post('/', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { title, description, location, start_time, end_time, points_reward, max_participants } = req.body;
  
  if (!title || !description || !location || !start_time || !end_time) {
    res.status(400).json({ error: '请填写完整的活动信息' });
    return;
  }
  
  const result = db.prepare(`
    INSERT INTO activities (title, description, location, start_time, end_time, points_reward, max_participants, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    title,
    description,
    location,
    start_time,
    end_time,
    points_reward || 0,
    max_participants || 0,
    req.user!.userId
  );
  
  res.json({
    message: '活动发布成功',
    id: Number(result.lastInsertRowid),
  });
});

router.put('/:id', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, location, start_time, end_time, points_reward, max_participants, status } = req.body;
  
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as Activity;
  if (!activity) {
    res.status(404).json({ error: '活动不存在' });
    return;
  }
  
  db.prepare(`
    UPDATE activities 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        location = COALESCE(?, location),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        points_reward = COALESCE(?, points_reward),
        max_participants = COALESCE(?, max_participants),
        status = COALESCE(?, status)
    WHERE id = ?
  `).run(
    title,
    description,
    location,
    start_time,
    end_time,
    points_reward,
    max_participants,
    status,
    id
  );
  
  res.json({ message: '活动更新成功' });
});

router.delete('/:id', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as Activity;
  if (!activity) {
    res.status(404).json({ error: '活动不存在' });
    return;
  }
  
  db.prepare('DELETE FROM activity_registrations WHERE activity_id = ?').run(id);
  db.prepare('DELETE FROM activities WHERE id = ?').run(id);
  
  res.json({ message: '活动已删除' });
});

router.post('/:id/register', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as Activity;
  if (!activity) {
    res.status(404).json({ error: '活动不存在' });
    return;
  }
  
  if (activity.status === 'cancelled') {
    res.status(400).json({ error: '活动已取消' });
    return;
  }
  
  if (activity.status === 'completed') {
    res.status(400).json({ error: '活动已结束' });
    return;
  }
  
  const existing = db.prepare(
    'SELECT * FROM activity_registrations WHERE activity_id = ? AND user_id = ?'
  ).get(id, userId);
  
  if (existing) {
    res.status(400).json({ error: '您已经报名了该活动' });
    return;
  }
  
  if (activity.max_participants > 0) {
    const registeredCount = (db.prepare(
      'SELECT COUNT(*) as cnt FROM activity_registrations WHERE activity_id = ?'
    ).get(id) as { cnt: number }).cnt;
    
    if (registeredCount >= activity.max_participants) {
      res.status(400).json({ error: '活动名额已满' });
      return;
    }
  }
  
  db.prepare(`
    INSERT INTO activity_registrations (activity_id, user_id, status)
    VALUES (?, ?, 'registered')
  `).run(id, userId);
  
  res.json({ message: '报名成功' });
});

router.post('/:id/cancel-register', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  
  const registration = db.prepare(
    'SELECT * FROM activity_registrations WHERE activity_id = ? AND user_id = ?'
  ).get(id, userId) as ActivityRegistration;
  
  if (!registration) {
    res.status(404).json({ error: '您未报名该活动' });
    return;
  }
  
  if (registration.status === 'completed') {
    res.status(400).json({ error: '活动已完成，无法取消报名' });
    return;
  }
  
  db.prepare('DELETE FROM activity_registrations WHERE id = ?').run(registration.id);
  
  res.json({ message: '已取消报名' });
});

router.post('/registrations/:regId/review', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { regId } = req.params;
  const { status, review_note } = req.body;
  
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: '无效的审核状态' });
    return;
  }
  
  const registration = db.prepare('SELECT * FROM activity_registrations WHERE id = ?').get(regId) as ActivityRegistration;
  if (!registration) {
    res.status(404).json({ error: '报名记录不存在' });
    return;
  }
  
  if (registration.status !== 'registered') {
    res.status(400).json({ error: '该报名已审核过' });
    return;
  }
  
  db.prepare(`
    UPDATE activity_registrations 
    SET status = ?, review_note = ?, reviewed_at = ?
    WHERE id = ?
  `).run(status, review_note || '', getLocalDateTime(), regId);
  
  res.json({ message: '审核成功' });
});

router.post('/registrations/:regId/complete', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { regId } = req.params;
  
  const registration = db.prepare(`
    SELECT r.*, a.title, a.points_reward, a.status as activity_status
    FROM activity_registrations r
    LEFT JOIN activities a ON r.activity_id = a.id
    WHERE r.id = ?
  `).get(regId) as ActivityRegistration & { title: string; points_reward: number; activity_status: string };
  
  if (!registration) {
    res.status(404).json({ error: '报名记录不存在' });
    return;
  }
  
  if (registration.status === 'completed') {
    res.status(400).json({ error: '该活动已完成并发放过积分' });
    return;
  }
  
  if (registration.status === 'rejected') {
    res.status(400).json({ error: '该报名已被拒绝' });
    return;
  }
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE activity_registrations 
      SET status = 'completed', reviewed_at = ?
      WHERE id = ?
    `).run(getLocalDateTime(), regId);
    
    if (registration.points_reward > 0) {
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(
        registration.points_reward,
        registration.user_id
      );
      
      db.prepare(`
        INSERT INTO point_logs (user_id, amount, type, description)
        VALUES (?, ?, 'activity', ?)
      `).run(
        registration.user_id,
        registration.points_reward,
        `参与活动「${registration.title}」获得积分奖励`
      );
    }
  });
  
  tx();
  
  res.json({ message: '活动完成，积分已发放' });
});

export default router;
