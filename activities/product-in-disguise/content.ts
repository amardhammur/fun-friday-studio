import { productSchema } from './types';

// Fixed, familiar products; the host can choose assignments before sharing briefs.
// Clues travel with their product and are never dealt independently.
export const products = [
  { id: 'stapler', name: 'Stapler', illustration: 'stapler', acceptedAnswers: ['Stapler'], clues: ['It fastens sheets of paper together.', 'Pressing it pushes a small metal fastener through the pages.'], tagline: 'The Togetherness Machine' },
  { id: 'umbrella', name: 'Umbrella', illustration: 'umbrella', acceptedAnswers: ['Umbrella', 'Parasol'], clues: ['It opens into a portable cover held above your head.', 'It keeps rain off you and folds away when you are done.'], tagline: 'Your Personal Weather Department' },
  { id: 'sticky-notes', name: 'Sticky notes', illustration: 'notes', acceptedAnswers: ['Sticky notes', 'Post-it notes', 'Post-its'], clues: ['These small paper squares hold written reminders.', 'A removable sticky edge lets you put them on a desk or wall.'], tagline: 'Memory, Now With Adhesive' },
  { id: 'lunchbox', name: 'Lunchbox', illustration: 'lunchbox', acceptedAnswers: ['Lunchbox', 'Lunch box', 'Tiffin box', 'Tiffin'], clues: ['It carries a meal you packed before leaving home.', 'A lid keeps the food inside until it is time to eat.'], tagline: 'The Portable Dining Experience' },
  { id: 'rubber-band', name: 'Rubber band', illustration: 'band', acceptedAnswers: ['Rubber band', 'Elastic band'], clues: ['It is a stretchy loop that returns towards its original size.', 'Wrap it around objects to hold them together without glue.'], tagline: 'A Commitment With Some Flexibility' },
  { id: 'torch', name: 'Torch', illustration: 'torch', acceptedAnswers: ['Torch', 'Flashlight'], clues: ['It shines a beam of light that you can point.', 'It is handheld and helps you see when it is dark.'], tagline: 'Daylight, On Demand' },
  { id: 'tape', name: 'Sticky tape', illustration: 'tape', acceptedAnswers: ['Sticky tape', 'Adhesive tape', 'Tape', 'Sellotape'], clues: ['It comes as a roll of sticky strip.', 'Cut or tear off a length to attach paper or seal a parcel.'], tagline: 'The Relationship Repair Kit' },
  { id: 'comb', name: 'Comb', illustration: 'comb', acceptedAnswers: ['Comb', 'Hair comb'], clues: ['It has a row of teeth that do not bite.', 'Pull it through hair to untangle or arrange it.'], tagline: 'Order For Your Morning Chaos' },
  { id: 'key', name: 'Key', illustration: 'key', acceptedAnswers: ['Key', 'Door key'], clues: ['It is shaped to fit a particular lock.', 'Turning it can unlock a door.'], tagline: 'Access, In Your Pocket' },
  { id: 'water-bottle', name: 'Water bottle', illustration: 'bottle', acceptedAnswers: ['Water bottle', 'Bottle', 'Drinking bottle'], clues: ['It carries drinking water wherever you go.', 'A cap closes its opening so you can carry it without spilling.'], tagline: 'Hydration Has Left The Building' },
  { id: 'clothes-peg', name: 'Clothes peg', illustration: 'peg', acceptedAnswers: ['Clothes peg', 'Clothespin', 'Clothes pin', 'Laundry clip'], clues: ['Squeezing one end opens its gripping jaws.', 'It holds wet clothing on a line while the clothing dries.'], tagline: 'The Anti-Flyaway Security System' },
  { id: 'whisk', name: 'Whisk', illustration: 'whisk', acceptedAnswers: ['Whisk', 'Egg whisk'], clues: ['It has loops of wire attached to a handle.', 'Move it quickly through eggs or cream to mix them and add air.'], tagline: 'A Workout For Your Breakfast' },
].map(product => productSchema.parse(product));
