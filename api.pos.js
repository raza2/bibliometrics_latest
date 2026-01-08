export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch("http://lekhari.aiou.edu.pk/pos/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.POS_API_TOKEN
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(200).json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "POS API failed" });
  }
}
