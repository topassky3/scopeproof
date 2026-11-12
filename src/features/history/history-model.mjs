/** Port of Lopera's rejection-reason matching from the Next.js prototype. */
export function buildHistoryEntries(review) {
  const approvals = review?.approvals ?? [];
  const used = new Set();
  const entries = (review?.events ?? []).map(event => {
    const rejected = event.type === 'review-rejected'
      || /^Review rejected\b/i.test(event.description ?? '');
    if (!rejected) return { ...event, rejectionReason: null };
    const index = approvals.findIndex((decision, position) =>
      !used.has(position)
      && decision.type === 'rejected'
      && decision.actor === event.actor
      && decision.createdAt === event.createdAt
    );
    if (index < 0) return { ...event, rejectionReason: null };
    used.add(index);
    return { ...event, rejectionReason: approvals[index].note || null };
  });
  return entries.reverse();
}
