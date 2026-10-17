const queries = [
  "grass footsteps", "sand footsteps", "wood footsteps", "snow footsteps",
  "stone footsteps", "tile footsteps", "carpet footsteps",
];
export {};
for (const query of queries) {
  const params = new URLSearchParams({
    q: query, license: "cc0", source: "freesound", length: "shortest", page_size: "3",
  });
  const url = `https://api.openverse.org/v1/audio/?${params}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${query}: ${response.status}`);
  const body: unknown = await response.json();
  console.log(JSON.stringify({ query, body }));
}
