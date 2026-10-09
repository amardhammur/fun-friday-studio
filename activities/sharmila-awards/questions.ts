export const starterQuestions = [
  'What is Java?',
  'What is a lever?',
  'What is electricity?',
  'What is power?',
  'What is the unit of power?',
  'What is resistance?',
  'What is the unit of resistance?',
  'How does a capacitor work?',
  'What is a battery?',
  'What is voltage?',
  'What is current?',
  'What is a switch?',
  'What is a motor?',
  'What is a fuse?',
  'What is a magnet?',
  'What is a gear?',
  'What is a pulley?',
  'What is a spring?',
  'What is a pump?',
  'What is an engine?',
  'What is a bridge?',
  'What is cement?',
  'What is concrete?',
  'What is steel?',
  'What is gravity?',
  'What is friction?',
  'What is pressure?',
  'What is heat?',
  'What is steam?',
  'What is Newton’s third law?',
  'What is a robot?',
  'What is a sensor?',
  'What is code?',
  'What is a software bug?',
  'What is a password?',
  'What is Wi-Fi?',
  'What is the internet?',
  'What is cloud computing?',
  'What is a keyboard?',
  'What is a network?',
];

export function questionList(text: string): string[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).map(line => line.trim().normalize('NFC')).filter(question => {
    const key = question.toLowerCase().replace(/\s+/g, ' ');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
