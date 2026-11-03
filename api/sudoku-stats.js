/* Per-puzzle start/finish counts for Cosmic Sudoku.
   Vercel KV (free tier) supplies KV_REST_API_URL and KV_REST_API_TOKEN.
   If those are missing, or KV errors, respond 204 so the page hides the stat.
   Never invent counts. */
module.exports = async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    var id = '';
    var event = '';
    if (req.method === 'GET') {
      id = String((req.query && req.query.id) || '');
    } else if (req.method === 'POST') {
      var body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
      }
      body = body || {};
      id = String(body.id || '');
      event = String(body.event || '');
    } else {
      res.status(204).end();
      return;
    }

    if (!validId(id)) {
      res.status(204).end();
      return;
    }
    if (req.method === 'POST' && event !== 'start' && event !== 'finish') {
      res.status(204).end();
      return;
    }

    var url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    var token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      res.status(204).end();
      return;
    }

    var startKey = 'sdk:start:' + id;
    var finishKey = 'sdk:finish:' + id;
    if (req.method === 'POST') {
      var key = event === 'start' ? startKey : finishKey;
      var wrote = await kv(url, token, ['INCR', key]);
      if (wrote == null) {
        res.status(204).end();
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    var counts = await kv(url, token, ['MGET', startKey, finishKey]);
    if (!Array.isArray(counts)) {
      res.status(204).end();
      return;
    }
    res.status(200).json({
      starts: toCount(counts[0]),
      finishes: toCount(counts[1])
    });
  } catch (err) {
    try { res.status(204).end(); } catch (e) {}
  }
};

function validId(id) {
  return /^(?:daily-\d{4}-\d{2}-\d{2}-(?:easy|medium|hard|expert)|(?:easy|medium|hard|expert)-\d{1,10})$/.test(id);
}

function toCount(value) {
  var n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

async function kv(url, token, command) {
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) return null;
  var data = await res.json();
  return data && Object.prototype.hasOwnProperty.call(data, 'result') ? data.result : null;
}
