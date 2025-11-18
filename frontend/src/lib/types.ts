// API Response Types based on Swagger schema

export interface MessageSchema {
  message: string;
}

export interface ErrorSchema {
  detail: string;
}

// Auth Types
export interface TokenSchema {
  access_token: string;
  refresh_token: string;
}

export interface MajorOption {
  code: string;
  label: string;
}

export interface UserProfileSchema {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  profile_picture?: string;
  bio?: string;
  student_id?: string | null;
  year_of_study?: number;
  university?: string;
  major?: string;
  date_joined: string;

  is_email_verified?: boolean;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_committee?: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface UserListSchema {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string | null;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
}

export interface UserRegistrationSchema {
  email: string;
  password: string;
  username: string;
  first_name: string;
  last_name: string;
  student_id: string;
  year_of_study: number;
  major: string;
  university: string;
}

export type UserUpdateSchema = {
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  year_of_study?: number | null;
  major?: string | null;
  university?: string | null;
  student_id?: number | null;
};


export interface UserLoginSchema {
  email: string;
  password: string;
}

export interface TokenRefreshIn {
  refresh_token: string;
}

export interface UsernameCheckSchema {
  available: boolean;
}

export interface PasswordResetRequestSchema {
  email: string;
}

export interface PasswordResetConfirmSchema {
  token: string;
  password: string;
}

// Blog Types
export interface PostListSchema {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image?: string;
  author: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    profile_picture?: string;
  };
  category?: {
    id: number;
    name: string;
    slug: string;
    description?: string;
  };
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  status: string;
  published_at?: string;
  created_at: string;
  is_featured: boolean;
  reading_time?: number;
}

export interface PostDetailSchema extends PostListSchema {
  content: string;
  updated_at: string;
  views_count?: number;
}

export interface PostCreateSchema {
  title: string;
  content: string;
  summary: string;
  category_id?: number;
  tag_ids?: number[];
  featured_image?: string;
  is_featured?: boolean;
  status?: 'draft' | 'published';
}

export interface CommentSchema {
  id: number;
  content: string;
  author: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  post_id: number;
  post_title: string;
  post_slug: string;
  parent_id?: number;
  created_at: string;
  is_approved: boolean;
}

export interface CommentCreateSchema {
  content: string;
  parent_id?: number;
}

export interface CategorySchema {
  id: number;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
}

export interface TagSchema {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

// Events Types
export interface EventListItemSchema {
  id: number;
  title: string;
  slug: string;
  description: string;
  featured_image?: string | null;
  absolute_featured_image_url?: string | null;
  event_type: 'online' | 'on_site' | 'hybrid';
  address?: string | null;
  location?: string | null;
  online_link?: string | null;
  start_time: string; // ISO
  end_time: string;   // ISO
  registration_start_date?: string | null;
  registration_end_date?: string | null;
  capacity?: number | null;
  price?: number | null;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  registration_count: number;
  created_at: string;
}

export interface EventGalleryItem {
  id: number;
  title: string;
  description: string;
  absolute_image_url?: string | null;
  width?: number;
  height?: number;
}

export interface EventDetailSchema extends EventListItemSchema {
  description_html: string;
  gallery_images: EventGalleryItem[];
  updated_at: string;
  registration_success_markdown: string;
}

export interface EventCreateSchema {
  title: string;
  description: string;
  start_date: string;
  end_date?: string;
  location: string;
  capacity?: number;
  event_image?: string;
  requirements?: string;
  is_registration_open?: boolean;
}

export interface PaymentAdminSchema {
  id: number;
  authority?: string | null;
  ref_id?: string | null;
  status: number;
  status_label: string;
  base_amount: number;
  discount_amount: number;
  amount: number;
  verified_at?: string | null;
  created_at: string;
  discount_code?: string | null;
}

export interface RegistrationAdminSchema {
  id: number;
  ticket_id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'attended';
  status_label: string;
  registered_at: string;
  final_price?: number | null;
  discount_amount?: number | null;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  payments: PaymentAdminSchema[];
}

export interface EventAdminDetailSchema extends EventDetailSchema {
  registrations: RegistrationAdminSchema[];
}
export interface EventUpdateSchema {
  title?: string;
  description?: string;
  event_type?: 'online' | 'on_site' | 'hybrid';
  address?: string | null;
  location?: string | null;
  online_link?: string | null;
  start_time?: string;
  end_time?: string | null;
  registration_start_date?: string | null;
  registration_end_date?: string | null;
  capacity?: number | null;
  price?: number | null;
  status?: 'draft' | 'published' | 'cancelled' | 'completed';
  gallery_image_ids?: number[] | null;
}

export interface EventRegistrationSchema {
  id: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'attended';
  ticket_id: string;
  registered_at: string;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  event_id: number;
}

export interface RegistrationStatusSchema {
  is_registered: boolean;
}

export interface MyEventRegistrationSchema {
  id: number;
  created_at: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'attended';
  event: EventListItemSchema;
}

// Gallery Types
export interface GalleryImageSchema {
  id: number;
  title: string;
  description?: string;
  image: string;
  uploaded_by: {
    id: number;
    username: string;
  };
  created_at: string;
  tags: TagSchema[];
}

export interface GalleryImageCreateSchema {
  title: string;
  description?: string;
  tag_ids?: number[];
}

// Pagination
export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next?: string;
  previous?: string;
}

// payment
export interface CreatePaymentOut {
  start_pay_url: string;
  authority: string;
  base_amount: number;
  discount_amount: number;
  amount: number;
}
