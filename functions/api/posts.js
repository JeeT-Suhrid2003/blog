// Cloudflare Pages Function
// Handles GET  /api/posts   -> returns all saved posts (public, read-only)
// Handles POST /api/posts   -> adds a new post (requires x-admin-key header)
//
// Requires a KV namespace bound as "POSTS_KV" and a secret env var "ADMIN_KEY".
// See README-deploy.md for setup steps.

export async function onRequestGet({ env }) {
  const raw = await env.POSTS_KV.get('posts');
  const posts = raw ? JSON.parse(raw) : [];
  return new Response(JSON.stringify(posts), {
    headers: { 'content-type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  const adminKey = request.headers.get('x-admin-key') || '';

  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }

  let newPost;
  try {
    newPost = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid json body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (!newPost || !newPost.title || !newPost.body) {
    return new Response(JSON.stringify({ error: 'missing title or body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const raw = await env.POSTS_KV.get('posts');
  const posts = raw ? JSON.parse(raw) : [];

  newPost.id = newPost.id || `c${Date.now()}`;
  newPost.createdAt = newPost.createdAt || Date.now();

  posts.unshift(newPost);
  await env.POSTS_KV.put('posts', JSON.stringify(posts));

  return new Response(JSON.stringify(posts), {
    headers: { 'content-type': 'application/json' }
  });
}

// Optional: DELETE /api/posts?id=xyz -> remove a post (also requires the key)
export async function onRequestDelete({ request, env }) {
  const adminKey = request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: 'missing id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const raw = await env.POSTS_KV.get('posts');
  const posts = raw ? JSON.parse(raw) : [];
  const filtered = posts.filter(p => p.id !== id);
  await env.POSTS_KV.put('posts', JSON.stringify(filtered));

  return new Response(JSON.stringify(filtered), {
    headers: { 'content-type': 'application/json' }
  });
}