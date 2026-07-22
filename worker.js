// Single Worker that does two jobs:
//   1. Serves the static site (blog.html and anything else in /public) via env.ASSETS
//   2. Handles the /api/posts endpoint (GET / POST / DELETE) backed by KV
//
// Deployed with `wrangler deploy` — see README-deploy.md for full setup.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/posts')) {
      return handleApiPosts(request, env);
    }

    // Anything else falls through to the static files in /public
    return env.ASSETS.fetch(request);
  }
};

async function handleApiPosts(request, env) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' }
    });

  if (request.method === 'GET') {
    const raw = await env.POSTS_KV.get('posts');
    const posts = raw ? JSON.parse(raw) : [];
    return json(posts);
  }

  if (request.method === 'POST') {
    const adminKey = request.headers.get('x-admin-key') || '';
    if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
      return json({ error: 'unauthorized' }, 401);
    }

    let newPost;
    try {
      newPost = await request.json();
    } catch (e) {
      return json({ error: 'invalid json body' }, 400);
    }

    if (!newPost || !newPost.title || !newPost.body) {
      return json({ error: 'missing title or body' }, 400);
    }

    const raw = await env.POSTS_KV.get('posts');
    const posts = raw ? JSON.parse(raw) : [];

    newPost.id = newPost.id || `c${Date.now()}`;
    newPost.createdAt = newPost.createdAt || Date.now();

    posts.unshift(newPost);
    await env.POSTS_KV.put('posts', JSON.stringify(posts));
    return json(posts);
  }

  if (request.method === 'DELETE') {
    const adminKey = request.headers.get('x-admin-key') || '';
    if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
      return json({ error: 'unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'missing id' }, 400);

    const raw = await env.POSTS_KV.get('posts');
    const posts = raw ? JSON.parse(raw) : [];
    const filtered = posts.filter(p => p.id !== id);
    await env.POSTS_KV.put('posts', JSON.stringify(filtered));
    return json(filtered);
  }

  return json({ error: 'method not allowed' }, 405);
}