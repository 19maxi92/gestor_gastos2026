export default async function handler(req, res) {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares', {
      headers: { 'Accept': 'application/json' },
    })
    if (!response.ok) throw new Error('API error')
    const data = await response.json()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate')
    res.status(200).json(data)
  } catch {
    res.status(500).json({ error: 'No se pudo obtener la cotización' })
  }
}
