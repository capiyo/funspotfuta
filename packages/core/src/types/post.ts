// Ported from funspot/lib/models/post_models.dart — the Post model,
// including its display helpers (displayCaption, postTypeDisplay,
// formattedDate, bestImageUrl).

export interface Post {
  id: string | null;
  userId: string | null;
  userName: string | null;
  caption: string | null;
  imageCaption: string | null;
  videoCaption: string | null;
  imageUrl: string | null;
  cloudinaryPublicId: string | null;
  imageFormat: string | null;
  firebaseImageUrl: string | null;
  firebaseImagePublicId: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  videoDuration: number | null;
  videoSize: number | null;
  firebasePublicId: string | null;
  postType: string | null;
  likesCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  likedBy: any[] | null;
  isSaved: boolean | null;
  timestamp: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastModified: string | null;
}

export function postFromJson(json: any): Post {
  return {
    id: (json.id ?? json._id)?.toString() ?? null,
    userId: json.user_id?.toString() ?? null,
    userName: json.user_name?.toString() ?? null,
    caption: json.caption?.toString() ?? null,
    imageCaption: json.image_caption?.toString() ?? null,
    videoCaption: json.video_caption?.toString() ?? null,
    imageUrl: json.image_url?.toString() ?? null,
    cloudinaryPublicId: json.cloudinary_public_id?.toString() ?? null,
    imageFormat: json.image_format?.toString() ?? null,
    firebaseImageUrl: json.firebase_image_url?.toString() ?? null,
    firebaseImagePublicId: json.firebase_image_public_id?.toString() ?? null,
    videoUrl: json.video_url?.toString() ?? null,
    videoThumbnailUrl: json.video_thumbnail_url?.toString() ?? null,
    videoDuration: json.video_duration != null ? Number(json.video_duration) : null,
    videoSize: json.video_size != null ? Number(json.video_size) : null,
    firebasePublicId: json.firebase_public_id?.toString() ?? null,
    postType: json.post_type?.toString() ?? null,
    likesCount: json.likes_count != null ? Number(json.likes_count) : null,
    commentsCount: json.comments_count != null ? Number(json.comments_count) : null,
    sharesCount: json.shares_count != null ? Number(json.shares_count) : null,
    likedBy: json.liked_by ?? null,
    isSaved: json.is_saved === true,
    timestamp: json.timestamp != null ? Number(json.timestamp) : null,
    createdAt: json.created_at?.toString() ?? null,
    updatedAt: json.updated_at?.toString() ?? null,
    lastModified: json.last_modified?.toString() ?? null,
  };
}

export const hasVideo = (p: Post) => Boolean(p.videoUrl);
export const hasImage = (p: Post) => Boolean(p.imageUrl);
export const hasCaption = (p: Post) => Boolean(p.caption);
export const bestImageUrl = (p: Post) => p.imageUrl ?? p.firebaseImageUrl;

export function displayCaption(p: Post): string {
  if (p.caption) return p.caption;
  if (p.imageCaption) return p.imageCaption;
  if (p.videoCaption) return p.videoCaption;
  return '';
}

export function postTypeDisplay(p: Post): string {
  switch (p.postType?.toLowerCase()) {
    case 'text':
      return '📝 Text';
    case 'image':
      return '🖼️ Image';
    case 'video':
      return '🎬 Video';
    case 'text_and_image':
      return '📝🖼️ Text & Image';
    case 'text_and_video':
      return '📝🎬 Text & Video';
    default:
      return '📝 Post';
  }
}

export function isLikedBy(p: Post, userId: string): boolean {
  return p.likedBy?.some((el) => el === userId) ?? false;
}

export function formattedDate(p: Post): string {
  if (!p.createdAt) return '';
  try {
    const date = new Date(p.createdAt);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 7) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  } catch {
    return '';
  }
}
