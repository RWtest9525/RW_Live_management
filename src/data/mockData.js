export const mockApps = [
  {
    id: 'app-1',
    name: 'QuickPay Wallet',
    category: 'Finance',
    syncedAt: '5 minutes ago',
    active: true,
    verifiedLive: 28,
    dropped: 6,
    hintSymbol: ',',
    verifiedUsernames: ['aman95', 'riya_s', 'niteshp', 'worker21', 'live_rahul'],
  },
  {
    id: 'app-2',
    name: 'FitPulse Pro',
    category: 'Health',
    syncedAt: '19 minutes ago',
    active: true,
    verifiedLive: 34,
    dropped: 5,
    hintSymbol: '.',
    verifiedUsernames: ['nehafit', 'runman', 'king_rohan', 'snowboy', 'zoe12'],
  },
  {
    id: 'app-3',
    name: 'Smart Study AI',
    category: 'Education',
    syncedAt: '31 minutes ago',
    active: true,
    verifiedLive: 18,
    dropped: 9,
    hintSymbol: 'A',
    verifiedUsernames: ['study_dj', 'priya_ai', 'fahad99', 'booklover', 'keshav'],
  },
  {
    id: 'app-4',
    name: 'Shoply Market',
    category: 'Shopping',
    syncedAt: '1 hour ago',
    active: false,
    verifiedLive: 12,
    dropped: 8,
    hintSymbol: ',',
    verifiedUsernames: ['anvi88', 'capsule_boy', 'rutuja', 'sky96'],
  },
  {
    id: 'app-5',
    name: 'TalkBridge',
    category: 'Social',
    syncedAt: '2 hours ago',
    active: true,
    verifiedLive: 41,
    dropped: 10,
    hintSymbol: '.',
    verifiedUsernames: ['rahulchat', 'talk2me', 'alpha_n', 'luna_77', 'echo31'],
  },
]

export const mockWorkers = [
  { id: 'w1', name: 'Aman Verma', role: 'Supervisor', status: 'Online' },
  { id: 'w2', name: 'Nisha Rao', role: 'Reviewer', status: 'Online' },
  { id: 'w3', name: 'Kabir Singh', role: 'Reviewer', status: 'Offline' },
  { id: 'w4', name: 'Sara Khan', role: 'Proof QA', status: 'Online' },
]

export const mockProofs = [
  { id: 'p1', appName: 'QuickPay Wallet', day: 'Day 7', createdAt: 'Today, 11:20 AM' },
  { id: 'p2', appName: 'FitPulse Pro', day: 'Day 7', createdAt: 'Today, 10:55 AM' },
  { id: 'p3', appName: 'TalkBridge', day: 'Day 7', createdAt: 'Today, 9:40 AM' },
]

export const mockReviews = [
  { id: 1, user: 'Aman V', rating: 5, time: '2h ago', text: 'Great service, instant workflow.' },
  { id: 2, user: 'Neha K', rating: 5, time: '3h ago', text: 'Smooth process and clean design.' },
  { id: 3, user: 'Rohan P', rating: 5, time: '4h ago', text: 'Reliable support for daily tracking.' },
  { id: 4, user: 'Pooja R', rating: 5, time: '5h ago', text: 'Easy to sync apps and verify live.' },
  { id: 5, user: 'Kabir S', rating: 5, time: '6h ago', text: 'Fast updates and clear dashboards.' },
  { id: 6, user: 'Riya M', rating: 5, time: '7h ago', text: 'Worker panel helped team visibility.' },
  { id: 7, user: 'Aarav N', rating: 5, time: '8h ago', text: 'Good payout tracking and proof flow.' },
  { id: 8, user: 'Nitesh J', rating: 5, time: '9h ago', text: 'Feels professional and stable.' },
  { id: 9, user: 'Ira T', rating: 5, time: '10h ago', text: 'Love the review card style.' },
  { id: 10, user: 'Sana D', rating: 5, time: '11h ago', text: 'Very clean business portal look.' },
]
