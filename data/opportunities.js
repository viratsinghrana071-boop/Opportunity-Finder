// data/opportunities.js

// Fetch all opportunities from backend
export async function fetchAllOpportunities() {
  try {
    const res = await fetch("https://opportunity-finder-7zgx.onrender.com/api/opportunities");
    const payload = await res.json();

    // Map backend data into frontend-friendly objects
    return (payload.opportunities || []).map(op => ({
      id: op.id,
      title: op.title,
      category: op.category,
      organizer: op.organizer,
      description: op.description,
      eligibility: op.eligibility,
      deadline: op.deadline,
      location: op.location,
      officialUrl: op.officialUrl,   // ✅ real live link from backend
      image: op.image,
      country: op.country,
      region: op.region,
      classLevel: op.classLevel,
      classLevels: op.classLevels,
      format: op.format,
      source: op.source,
      expired: op.expired
    }));
  } catch (e) {
    console.error("Opportunities fetch failed", e);
    return [];
  }
}
