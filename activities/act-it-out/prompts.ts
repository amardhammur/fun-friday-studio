export interface Prompt { text: string; category: string }
// Office Life carries the theme. The other three exist so a room that has exhausted
// the in-jokes still has somewhere to go.
export const categories = ['Office Life', 'Movies & TV', 'Actions', 'Around the House'] as const;
const deck: Record<(typeof categories)[number], string[]> = {
  'Office Life': [
    'Printer jam', 'Monday stand-up', 'Back-to-back meetings', 'The coffee machine is broken', 'Reply all',
    'Out of office', 'Still on mute', 'Hot desking', 'Fire drill', 'Team building day',
    'Taking the last biscuit', 'Wrong meeting room', 'The laptop will not find the projector', 'Appraisal', 'Fixing the wifi',
    'Birthday cake in the kitchen', 'Emailing the wrong person', 'A sink full of mugs', 'Locked out of the building', 'Standing desk',
    'Someone microwaving fish', 'Expenses claim', 'First day induction', 'Your password has expired', 'Sharing the wrong window',
    'Running for the lift', 'Secret Santa', 'The office plant slowly dying', 'A whiteboard marker that does not work', 'Leaving drinks',
  ],
  'Movies & TV': [
    'Jurassic Park', 'Titanic', 'The Lion King', 'Jaws', 'Star Wars',
    'Ghostbusters', 'Harry Potter', 'The Matrix', 'Rocky', 'E.T.',
    'Bake Off', 'Mary Poppins', 'Home Alone', 'Toy Story', 'Indiana Jones',
    'Frozen', 'Pirates of the Caribbean', 'The Godfather', 'Finding Nemo', 'James Bond',
    'Dirty Dancing', 'Grease', 'Shrek', 'The Wizard of Oz', 'Men in Black',
    'Back to the Future', 'Forrest Gump', 'The Sound of Music', 'King Kong', "Singin' in the Rain",
  ],
  Actions: [
    'Parallel parking', 'Threading a needle', 'Walking a stubborn dog', 'Building flat-pack furniture', 'Blowing up a balloon',
    'Climbing a ladder', 'Juggling', 'Wrapping a present', 'Swatting a fly', 'An umbrella in the wind',
    'Carrying too many shopping bags', 'Tying a tie', 'Changing a lightbulb', 'Rowing a boat', 'Doing a jigsaw',
    'Ice skating', 'Taking a selfie', 'Opening a stuck jar', 'Painting a ceiling', 'Sneezing over and over',
    'Tiptoeing past a sleeping baby', 'Hailing a taxi', 'Doing the washing up', 'Skipping rope', 'Untangling headphones',
    'Eating spaghetti', 'Putting on wet jeans', 'Pushing a broken-down car', 'Reading a map upside down', 'Catching a bus that is pulling away',
  ],
  'Around the House': [
    'Smoke alarm battery', 'Doorbell', 'Vacuum cleaner', 'Ironing board', 'Leaky tap',
    'Sofa', 'Kettle', 'Washing line', 'Hoovering under the bed', 'Toaster',
    'Garden hose', 'Bookshelf', 'Bathroom mirror', 'Grandfather clock', 'Rocking chair',
    'Fridge magnet', 'Shoe rack', 'Cat flap', 'Chest of drawers', 'Bedside lamp',
    'Welcome mat', 'Laundry basket', 'Shower curtain', 'Coat hook', 'The remote down the back of the sofa',
    'Bin day', 'Dripping radiator', 'The spare key under the mat', 'Stairs that creak', 'Letterbox',
  ],
};
export const bundledPrompts: Prompt[] = categories.flatMap(category => deck[category].map(text => ({ text, category })));
export const promptsIn = (names: string[]) => bundledPrompts.filter(p => names.includes(p.category));
