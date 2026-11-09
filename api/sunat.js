export default async function handler(req, res) {
  // Encabezados CORS para permitir comunicación segura desde el cliente
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const API_TOKEN = process.env.VITE_API_SUNAT_TOKEN || process.env.API_SUNAT_TOKEN || "2def7b1448e04c9763445c648197b71d7852c21deaafa1a937772798ff81254b";
  const API_URL = "https://app.apiperu.dev/api/cpe";

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { success: false, message: text || `Error HTTP ${response.status} devuelto por ApiPeru` };
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error en proxy ApiPeru:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
