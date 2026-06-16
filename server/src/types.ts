export interface User {
  id: number;
  username: string;
  password: string;
  nickname: string;
  role: 'resident' | 'admin';
  avatar: string;
  points: number;
  created_at: string;
}

export interface CheckinRecord {
  id: number;
  user_id: number;
  category: 'recyclable' | 'kitchen' | 'hazardous' | 'other';
  weight: number;
  location: string;
  points: number;
  checkin_date: string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  created_at: string;
}

export interface ExchangeRecord {
  id: number;
  user_id: number;
  product_id: number;
  product_name: string;
  points_cost: number;
  created_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export interface PointLog {
  id: number;
  user_id: number;
  amount: number;
  type: 'checkin' | 'bonus' | 'exchange' | 'activity';
  description: string;
  created_at: string;
}

export interface Activity {
  id: number;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  points_reward: number;
  max_participants: number;
  status: 'pending' | 'ongoing' | 'completed' | 'cancelled';
  created_by: number;
  created_at: string;
}

export interface ActivityRegistration {
  id: number;
  activity_id: number;
  user_id: number;
  status: 'registered' | 'approved' | 'rejected' | 'completed';
  review_note?: string;
  registered_at: string;
  reviewed_at?: string;
  activity?: Activity;
}

export interface ActivityWithStats extends Activity {
  registered_count: number;
}

export interface JwtPayload {
  userId: number;
  role: 'resident' | 'admin';
}
