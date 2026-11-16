export default async function handler(req, res) {
  // Encabezados CORS universales
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.APIPERU_TOKEN || 
                process.env.VITE_API_SUNAT_TOKEN || 
                process.env.API_SUNAT_TOKEN || 
                "2def7b1448e04c9763445c648197b71d7852c21deaafa1a937772798ff81254b";

  try {
    let body = {};
    if (req.method === 'POST') {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } else {
      body = req.query || {};
    }

    const dni = (body.dni || body.numDoc || '').toString().trim();
    const ruc = (body.ruc || '').toString().trim();

    // 1. Consulta de DNI (8 dígitos numéricos)
    if (dni && /^\d{8}$/.test(dni)) {
      const response = await fetch('https://apiperu.dev/api/dni', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ dni })
      });

      const json = await response.json();
      if (response.ok && json && json.success && json.data) {
        const d = json.data;
        const nombreCompleto = d.nombre_completo || 
          `${d.nombres || ''} ${d.apellido_paterno || ''} ${d.apellido_materno || ''}`.trim();

        return res.status(200).json({
          success: true,
          tipo: 'dni',
          nombre_completo: nombreCompleto,
          data: {
            dni,
            nombre_completo: nombreCompleto,
            nombres: d.nombres || '',
            apellido_paterno: d.apellido_paterno || '',
            apellido_materno: d.apellido_materno || ''
          }
        });
      } else {
        return res.status(200).json({
          success: false,
          message: json?.message || 'No se encontró información para el DNI ingresado'
        });
      }
    }

    // 2. Consulta de RUC (11 dígitos numéricos iniciando con 10 o 20)
    if (ruc && /^\d{11}$/.test(ruc)) {
      const response = await fetch('https://apiperu.dev/api/ruc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ ruc })
      });

      const json = await response.json();
      if (response.ok && json && json.success && json.data) {
        const d = json.data;
        const razonSocial = d.nombre_o_razon_social || d.razon_social || '';
        const direccionCompleta = d.direccion_completa || d.direccion || '';

        return res.status(200).json({
          success: true,
          tipo: 'ruc',
          nombre_o_razon_social: razonSocial,
          direccion_completa: direccionCompleta,
          data: {
            ruc,
            nombre_o_razon_social: razonSocial,
            direccion_completa: direccionCompleta,
            estado: d.estado || '',
            condicion: d.condicion || ''
          }
        });
      } else {
        return res.status(200).json({
          success: false,
          message: json?.message || 'No se encontró información para el RUC ingresado'
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Debe ingresar un DNI de 8 dígitos o un RUC de 11 dígitos válido'
    });
  } catch (error) {
    console.error('Error en api/consultar-doc:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error interno al consultar documento en ApiPeru'
    });
  }
}
