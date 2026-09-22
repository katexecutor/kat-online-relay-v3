async function attach(relayUrl, token) {
  const response = await fetch(`${relayUrl}/session`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Invalid session token");
  }

  return response.json();
}

async function execute(relayUrl, token, source) {
  const response = await fetch(`${relayUrl}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ source })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Execution failed");
  }

  return data;
}
