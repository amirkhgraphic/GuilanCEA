import type * as Types from './types';

const API_BASE_URL = 'https://api.east-guilan-ce.ir';

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      throw new Error('Session expired. Please login again.');
    }

    const data: Types.TokenSchema = await response.json();
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token); 
    return data.access_token;
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    // Handle 401 with automatic token refresh
    if (response.status === 401 && localStorage.getItem('refresh_token')) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const newToken = await this.refreshAccessToken();
          this.isRefreshing = false;
          this.onRefreshed(newToken);

          // After you obtained `newToken` successfully:
          const retryConfig: RequestInit = {
            ...options,
            headers: {
              ...(options.headers || {}),
              Authorization: `Bearer ${newToken}`, // put last so it can't be overwritten
            },
          };
          const retryResponse = await fetch(url, retryConfig);
          if (!retryResponse.ok) {
            const err = await retryResponse.json().catch(() => ({}));
            throw new Error(err.error || err.detail || 'Request failed');
          }
          return retryResponse.json();

        } catch (error) {
          this.isRefreshing = false;
          throw error;
        }
      } else {
        return new Promise((resolve, reject) => {
          this.addRefreshSubscriber(async (token: string) => {
            try {
              const retryConfig: RequestInit = {
                ...options,
                headers: {
                  ...(options.headers || {}),
                  Authorization: `Bearer ${token}`,
                },
              };
              const retryResponse = await fetch(url, retryConfig);
              if (!retryResponse.ok) {
                const err = await retryResponse.json().catch(() => ({}));
                reject(new Error(err.error || err.detail || 'Request failed after refresh'));
              } else {
                resolve(retryResponse.json());
              }
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({} as any));
      const message =
        body?.error || body?.detail || body?.message || 'خطای ناشناخته رخ داد';
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  // ============= Auth Endpoints =============
  
  async register(data: Types.UserRegistrationSchema) {
    return this.request<Types.MessageSchema>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: Types.UserLoginSchema) {
    return this.request<Types.TokenSchema>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refreshToken(data: Types.TokenRefreshIn) {
    return this.request<Types.TokenSchema>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyEmail(token: string): Promise<Types.MessageSchema> {
    const url = `${this.baseUrl}/api/auth/verify-email/${encodeURIComponent(token)}`;
    const response = await fetch(url, { method: 'GET' });

    if (response.ok) {
      return response.json() as Promise<Types.MessageSchema>;
    }

    const data = await response.json().catch(() => ({} as any));
    const errMsg: string =
      (data && (data.error || data.detail)) || 'خطای ناشناخته رخ داد';
    throw new Error(errMsg);
  }


  async resendVerification(email: string) {
    return this.request<Types.MessageSchema>(
      `/api/auth/resend-verification?email=${encodeURIComponent(email)}`, 
      { method: 'POST' }
    );
  }

  async getProfile() {
    const token = localStorage.getItem('access_token');
    return this.request<Types.UserProfileSchema>('/api/auth/profile'
    );
  }

  async updateProfile(data: Types.UserUpdateSchema) {
    return this.request<Types.UserProfileSchema>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadProfilePicture(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${this.baseUrl}/api/auth/profile/picture`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error: Types.ErrorSchema = await response.json().catch(() => ({
        detail: 'خطای آپلود تصویر',
      }));
      throw new Error(error.detail);
    }

    return response.json() as Promise<Types.MessageSchema>;
  }

  async deleteProfilePicture() {
    return this.request<Types.MessageSchema>('/api/auth/profile/picture', {
      method: 'DELETE',
    });
  }

  async requestPasswordReset(email: string) {
    return this.request<Types.MessageSchema>('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  }

  async resetPasswordConfirm(token: string, new_password: string) {
    return this.request<Types.MessageSchema>('/api/auth/reset-password-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password }),
    });
  }


  async checkUsername(username: string) {
    return this.request<Types.UsernameCheckSchema>(
      `/api/auth/check-username?username=${encodeURIComponent(username)}`
    );
  }

  // Admin auth endpoints
  async listDeletedUsers() {
    return this.request<Types.UserProfileSchema[]>('/api/auth/users/deleted');
  }

  async restoreUser(userId: number) {
    return this.request<Types.MessageSchema>(`/api/auth/users/${userId}/restore`, {
      method: 'POST',
    });
  }

  // ============= Blog Endpoints =============
  
  async getPosts(params?: {
    page?: number;
    limit?: number;
    category?: string;
    tag?: string;
    search?: string;
    featured?: boolean;
    author?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.tag) queryParams.append('tag', params.tag);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.featured !== undefined) queryParams.append('featured', params.featured.toString());
    if (params?.author) queryParams.append('author', params.author);

    const query = queryParams.toString();
    return this.request<Types.PostListSchema[]>(`/api/blog/posts${query ? `?${query}` : ''}`);
    }
  
  async getPost(slug: string) {
    return this.request<Types.PostDetailSchema>(`/api/blog/posts/${slug}`);
  }

  async createPost(data: Types.PostCreateSchema) {
    return this.request<Types.PostDetailSchema>('/api/blog/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePost(slug: string, data: Types.PostCreateSchema) {
    return this.request<Types.PostDetailSchema>(`/api/blog/posts/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePost(slug: string) {
    return this.request<Types.MessageSchema>(`/api/blog/posts/${slug}`, {
      method: 'DELETE',
    });
  }

  async listDeletedPosts() {
    return this.request<Types.PostListSchema[]>('/api/blog/deleted/posts');
  }

  async restorePost(postId: number) {
    return this.request<Types.MessageSchema>(`/api/blog/deleted/posts/${postId}/restore`, {
      method: 'POST',
    });
  }

  // Comments
  async getComments(slug: string) {
    return this.request<Types.CommentSchema[]>(`/api/blog/posts/${slug}/comments`);
  }

  async createComment(slug: string, data: Types.CommentCreateSchema) {
    return this.request<Types.CommentSchema>(`/api/blog/posts/${slug}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listDeletedComments() {
    return this.request<Types.CommentSchema[]>('/api/blog/deleted/comments');
  }

  async restoreComment(commentId: number) {
    return this.request<Types.MessageSchema>(`/api/blog/deleted/comments/${commentId}/restore`, {
      method: 'POST',
    });
  }

  // Likes
  async toggleLike(slug: string) {
    return this.request<Types.MessageSchema>(`/api/blog/posts/${slug}/like`, {
      method: 'POST',
    });
  }

  async getLikesCount(slug: string) {
    return this.request<Types.MessageSchema>(`/api/blog/posts/${slug}/likes`);
  }

  // Categories
  async getCategories() {
    return this.request<Types.CategorySchema[]>('/api/blog/categories');
  }

  async getCategory(slug: string) {
    return this.request<Types.CategorySchema>(`/api/blog/categories/${slug}`);
  }

  async listDeletedCategories() {
    return this.request<Types.CategorySchema[]>('/api/blog/deleted/categories');
  }

  async restoreCategory(categoryId: number) {
    return this.request<Types.MessageSchema>(`/api/blog/deleted/categories/${categoryId}/restore`, {
      method: 'POST',
    });
  }

  // Tags
  async getTags() {
    return this.request<Types.TagSchema[]>('/api/blog/tags');
  }

  async getTag(slug: string) {
    return this.request<Types.TagSchema>(`/api/blog/tags/${slug}`);
  }

  async listDeletedTags() {
    return this.request<Types.TagSchema[]>('/api/blog/deleted/tags');
  }

  async restoreTag(tagId: number) {
    return this.request<Types.MessageSchema>(`/api/blog/deleted/tags/${tagId}/restore`, {
      method: 'POST',
    });
  }

  // ============= Events Endpoints =============

  async getEvents(params: {
    status?: 'draft' | 'published' | 'cancelled' | 'completed';
    statuses?: Array<'draft' | 'published' | 'cancelled' | 'completed'>; // جدید: چندتا وضعیت
    event_type?: 'online' | 'on_site' | 'hybrid';
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const q = new URLSearchParams();

    if (params.statuses?.length) {
      params.statuses.forEach(s => q.append('status', s));
    } else if (params.status) {
      q.set('status', params.status);
    }
    if (params.event_type) q.set('event_type', params.event_type);
    if (params.search) q.set('search', params.search);
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.offset != null) q.set('offset', String(params.offset));
    const url = `/api/events/${q.toString() ? `?${q.toString()}` : ''}`;
    return this.request<Types.EventListItemSchema[]>(url, { method: 'GET' });
  }

  async getEventBySlug(slug: string) {
    return this.request<Types.EventDetailSchema>(`/api/events/slug/${encodeURIComponent(slug)}`, { method: 'GET' });
  }

  async registerForEvent(eventId: number, discountCode?: string | null) {
    const payload = (discountCode ?? '').trim();
    const init: RequestInit = { method: 'POST' };
    if (payload) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify({ discount_code: payload });
    }
    return this.request<Types.EventRegistrationSchema>(`/api/events/${eventId}/register`, init);
  }

  async ChangeRegistrationStatus(registrationId: number, status: string) {
    return this.request(
      `/api/events/registrations/${registrationId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status }),
      }
    );
  }
  
  async listEventRegistrations(eventId: number, limit = 20, offset = 0) {
    const url = `/api/events/${eventId}/registrations?limit=${limit}&offset=${offset}`;
    return this.request<Types.EventRegistrationSchema[]>(url, { method: 'GET' });
  }

  async cancelEventRegistration(eventId: number) {
    return this.request<Types.MessageSchema>(`/api/events/${eventId}/register`, {
      method: 'DELETE',
    });
  }

  async verifyMyRegistration(ticket_id: string) {
    return this.request<{
      event_image: string;
      event_title: string;
      event_type: string;
      ticket_id: string;
      status: string;
      registered_at: string;
      success_markdown: string;
    }>(`/api/events/registerations/verify/${ticket_id}`, {method: 'GET'});
  }

  async getMyRegistrations() {
    return this.request<Types.MyEventRegistrationSchema[]>(
      `/api/events/my-registrations`,
      { method: 'GET' }
    );
  }

  async getRegistrationStatus(eventId: number) {
    return this.request<Types.RegistrationStatusSchema>(
      `/api/events/${eventId}/is-registered`,
      { method: 'GET' }
    );
  }

  // ============= Payment Endpoints =============
  async createPayment(input: {
    event_id: number;
    description: string;
    discount_code?: string | null;
    mobile?: string | null;
    email?: string | null;
  }) {
    return this.request<Types.CreatePaymentOut>(
      '/api/payments/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }
    );
  }

  async getPaymentByRef(refId: string) {
    return this.request<{
      ref_id: string;
      authority: string;
      base_amount: number;
      discount_amount: number;
      amount: number;
      status: 'INIT' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED';
      verified_at?: string | null;
      event: {
        id: number;
        title: string;
        slug: string;
        image_url?: string | null;
        success_markdown?: string | null;
      };
    }>(`/api/payments/by-ref/${encodeURIComponent(refId)}`, { method: 'GET' });
  }

  async checkDiscountCode(event_id: number, code: string) {
    return this.request<{
      discount_amount: number;
      final_price: number;
    }>(
      `/api/payments/coupon/check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({code: code, event_id: event_id}),
      }
    );
  }

  // ============= Gallery Endpoints =============
  
  async getGalleryImages(params?: {
    page?: number;
    limit?: number;
    tag?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.tag) queryParams.append('tag', params.tag);

    const query = queryParams.toString();
    return this.request<Types.GalleryImageSchema[]>(`/api/gallery/images${query ? `?${query}` : ''}`);
  }

  async uploadGalleryImage(file: File, data: Types.GalleryImageCreateSchema) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.tag_ids) formData.append('tag_ids', JSON.stringify(data.tag_ids));
    
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${this.baseUrl}/api/gallery/images`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error: Types.ErrorSchema = await response.json().catch(() => ({
        detail: 'خطای آپلود تصویر',
      }));
      throw new Error(error.detail);
    }

    return response.json() as Promise<Types.GalleryImageSchema>;
  }

  async deleteGalleryImage(imageId: number) {
    return this.request<Types.MessageSchema>(`/api/gallery/images/${imageId}`, {
      method: 'DELETE',
    });
  }

  async getMajors(): Promise<Types.MajorOption[]> {
    return this.request('/api/meta/majors', { method: 'GET' });
  }

  async getUniversities(): Promise<Types.MajorOption[]> {
    return this.request('/api/meta/universities', { method: 'GET' });
  }

  async subscribeNewsletter(email: string) {
    return this.request<{ message: string, success: boolean }>(
      `/api/communications/newsletter/subscribe/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      }
    );
  }
}

export const api = new ApiClient(API_BASE_URL);
