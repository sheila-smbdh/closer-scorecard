// Usage: node src/booked-slots.mjs <data.json> <calendly-events.json>
// For each of Messi's daily slot posts (8am ET), counts the discovery calls each closer already had booked
// over the same next 7 days, as Calendly stood at that moment: created before the post, and not cancelled
// before it. Open slots (Messi) + booked calls = the closer's discovery capacity, which is what the 25
// target is measured on. Writes `slots_booked["MM-DD"][closer]` into the snapshot.
// The events file is a read-only Calendly pull: {closers: {key: [{name, start, status, created, canceled_at}]}}.

import fs from 'node:fs';

const [dataPath, eventsPath] = process.argv.slice(2);
if (!dataPath || !eventsPath) {
  console.error('usage: node src/booked-slots.mjs <data.json> <calendly-events.json>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const ev = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));

// Client discovery calls only (the event types Messi's open-slot count is for)
export const isDiscovery = (name) => /discovery/i.test(name);

const year = data.trackers ? Object.values(data.trackers)[0].through.slice(0, 4) : '2026';
const DAY = 86400000;
// 8am ET as UTC; EDT until Nov 1 2026, EST after
const postTime = (mmdd) => {
  const d = new Date(`${year}-${mmdd}T12:00:00Z`);
  return d >= new Date(`${year}-11-01T06:00:00Z`) ? new Date(d.getTime() + 3600000) : d;
};

const days = Object.keys(data.messi_slots ?? {}).sort();
const out = {};
for (const day of days) {
  const t = postTime(day);
  out[day] = {};
  for (const [key, list] of Object.entries(ev.closers)) {
    out[day][key] = list.filter((e) => isDiscovery(e.name)
      && new Date(e.created) < t
      && (e.status === 'active' || (e.canceled_at && new Date(e.canceled_at) > t))
      && new Date(e.start) >= t && new Date(e.start) < new Date(t.getTime() + 7 * DAY)).length;
  }
}
data.slots_booked = out;
data._slots_booked_note = `Discovery calls already booked over the next 7 days at each Messi post (8am ET), per closer, from Calendly (pulled ${ev.pulled_at}). Open slots + booked = capacity, scored against the 25 target.`;
fs.writeFileSync(dataPath, JSON.stringify(data, null, 1) + '\n');
console.log(`booked discovery calls for ${days.length} post days: ${days.join(', ')}`);
