import { useEffect, useState } from 'react';
import { getPosts, type Post } from '@funspot/core';
import { useAuth } from '@/lib/auth-context';

export default function FeedScreen() {
  const { userId } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    getPosts({ page, limit: 20, userId: userId ?? undefined })
      .then((result) => { if (alive) setPosts(result.posts); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load the feed.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, userId]);

  return <div className="pane-content">
    <div className="pane-heading"><div><p className="eyebrow">FROM THE COMMUNITY</p><h1>Feed</h1></div><button className="button button-quiet" onClick={() => setPage(1)} aria-label="Refresh feed">↻</button></div>
    {loading && <div className="skeleton-list" role="status" aria-label="Loading feed">{[0,1,2].map((i) => <div className="skeleton-post" key={i} />)}</div>}
    {!loading && error && <div className="error-state" role="alert"><p>{error}</p><button className="button" onClick={() => setPage((n) => n)}>Try again</button></div>}
    {!loading && !error && posts.length === 0 && <div className="empty-state"><h2>No posts yet</h2><p>New community posts will appear here.</p></div>}
    {!loading && !error && <div className="feed-list">{posts.map((post, index) => {
      const item = post as Post & Record<string, any>;
      const id = String(item.id ?? item._id ?? index);
      const author = item.username ?? item.user_name ?? item.author?.username ?? 'Funspot fan';
      const caption = item.caption ?? item.text ?? item.content ?? '';
      const image = item.imageUrl ?? item.image_url ?? item.image;
      return <article className="post-card" key={id}><div className="post-author"><span className="mini-avatar">{String(author).slice(0,1).toUpperCase()}</span><div><strong>{author}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Community post'}</small></div></div>{caption && <p className="post-caption">{caption}</p>}{typeof image === 'string' && image && <img className="post-image" src={image} alt="Post attachment" loading="lazy" />}{Array.isArray(item.images) && item.images.map((url: string, i: number) => <img key={url + i} className="post-image" src={url} alt="Post attachment" loading="lazy" />)}</article>;
    })}</div>}
  </div>;
}
