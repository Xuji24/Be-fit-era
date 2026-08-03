import { RaceEvent } from "@/utils/types/race-types";

export const racesData: RaceEvent[] = [
  {
    id: "1",
    dbId: "a1b2c3d4-0001-4000-8000-000000000001",
    title: "Manila Sunrise Marathon 2026",
    organizer: "RunPH Events",
    date: "June 21, 2026",
    time: "5:00 AM",
    location: "Manila, Philippines",
    category: "Marathon",
    description:
      "Experience the beauty of Manila at sunrise as you run through historical landmarks and scenic routes.",
    fullDescription:
      "The Manila Sunrise Marathon 2026 takes runners on an unforgettable journey through the heart of Manila. Starting at Rizal Park, the route passes through Intramuros, the Manila Baywalk, and other iconic landmarks. Whether you're a seasoned marathoner or challenging yourself for the first time, this event promises a world-class experience with full hydration stations, medical support, chip timing, and a stunning finisher's medal. Post-race celebrations include live music, food stalls, and an awards ceremony.",
    image: "/fitra.png",
    organizerLogo: "/fitra-logo.png",
    participants: 1200,
    maxParticipants: 2000,
    registrationOpen: true,
    registrationDeadline: "June 14, 2026",
    rewards: {
      medal: {
        name: "Sunrise Finisher's Medal",
        description:
          "Gold-plated medal featuring the Manila skyline at dawn with an engraved distance marker.",
      },
      eCertificate: {
        title: "Official Finisher's E-Certificate",
        description:
          "Digital certificate with your name, finishing time, and official race results. Downloadable and shareable.",
      },
      prizes: [
        "Premium tech shirt for all finishers",
        "Top 3 per age group: Trophy + cash prize",
        "Best costume award: ₱5,000 gift certificate",
      ],
    },
    registrationFee: 1200,
    cutoffTimeMinutes: 480,
    kitPickupInfo: "June 19–20, 2026 at Rizal Park Entrance, 8AM–5PM",
    inclusions: [
      "Medal",
      "T-Shirt",
      "E-Certificate",
      "Timing Chip",
      "Loot Bag",
    ],
  },
  {
    id: "2",
    dbId: "a1b2c3d4-0002-4000-8000-000000000002",
    title: "Cebu Island 10K Challenge",
    organizer: "Island Runners PH",
    date: "July 5, 2026",
    time: "6:00 AM",
    location: "Cebu City, Philippines",
    category: "10K",
    description:
      "A scenic 10K run through Cebu's most beautiful coastal roads and urban trails.",
    fullDescription:
      "The Cebu Island 10K Challenge is designed for runners who love coastal scenery and vibrant city culture. Starting from the Cebu IT Park, the course winds through Lahug, passes the Temple of Leah viewpoint area, and finishes at the Cebu Business Park. Expect a fast, flat course ideal for personal bests. All finishers receive a premium tech shirt, finisher's medal, and loot bag. Top 3 in each age group receive special prizes.",
    image: "/fitra.png",
    organizerLogo: "/fitra-logo.png",
    participants: 450,
    maxParticipants: 500,
    registrationOpen: true,
    registrationDeadline: "July 1, 2026",
    rewards: {
      medal: {
        name: "Island Runner Medal",
        description:
          "Coastal-themed finisher's medal with a wave design and 10K distance engraving.",
      },
      eCertificate: {
        title: "Official Finisher's E-Certificate",
        description:
          "Digital certificate with your name, finishing time, and official race results. Downloadable and shareable.",
      },
      prizes: [
        "Premium tech shirt for all finishers",
        "Finisher's loot bag with sponsor products",
        "Top 3 per age group: Special prizes",
      ],
    },
    registrationFee: 700,
    cutoffTimeMinutes: 120,
    kitPickupInfo: "July 3–4, 2026 at Cebu IT Park Activity Area, 9AM–6PM",
    inclusions: ["Medal", "T-Shirt", "E-Certificate", "Loot Bag"],
  },
  {
    id: "3",
    dbId: "a1b2c3d4-0003-4000-8000-000000000003",
    title: "BGC Night Run 5K",
    organizer: "Metro Run Club",
    date: "July 19, 2026",
    time: "7:00 PM",
    location: "Taguig, Philippines",
    category: "5K",
    description:
      "A fun nighttime 5K run through the vibrant streets of Bonifacio Global City.",
    fullDescription:
      "BGC Night Run 5K is a fun, community-driven event perfect for beginners and casual runners. The route loops through the well-lit streets of BGC, passing High Street, Terra 28th, and Mind Museum. The event features glow sticks, LED armbands, and a post-run party with DJs and food trucks. Families and groups are welcome! Every finisher gets a glow-in-the-dark medal and event shirt.",
    image: "/fitra.png",
    organizerLogo: "/fitra-logo.png",
    participants: 300,
    maxParticipants: 800,
    registrationOpen: true,
    registrationDeadline: "July 15, 2026",
    rewards: {
      medal: {
        name: "Glow Runner Medal",
        description:
          "Glow-in-the-dark finisher's medal shaped like a lightning bolt.",
      },
      eCertificate: {
        title: "Official Finisher's E-Certificate",
        description:
          "Digital certificate with your name, finishing time, and official race results. Downloadable and shareable.",
      },
      prizes: [
        "Glow-in-the-dark event shirt",
        "LED armband for every participant",
        "Best glow outfit: ₱3,000 gift certificate",
      ],
    },
    registrationFee: 500,
    cutoffTimeMinutes: 90,
    kitPickupInfo: "July 17–18, 2026 at BGC Central Square, 10AM–8PM",
    inclusions: ["Medal", "T-Shirt", "E-Certificate", "LED Armband"],
  },
  {
    id: "4",
    dbId: "a1b2c3d4-0004-4000-8000-000000000004",
    title: "Baguio Half Marathon",
    organizer: "Highland Runners",
    date: "August 9, 2026",
    time: "4:30 AM",
    location: "Baguio City, Philippines",
    category: "Half Marathon",
    description:
      "Challenge yourself on the cool mountain trails of Baguio City in this half marathon.",
    fullDescription:
      "The Baguio Half Marathon is one of the most challenging yet rewarding races in the Philippines. Running at an elevation of 1,500 meters, participants experience cooler temperatures and pine-fresh air. The route passes through Camp John Hay, Burnham Park, and the scenic Kennon Road overlook. This is a true test of endurance with rolling hills and breathtaking views. Aid stations every 3km, full medical team, and chip timing included.",
    image: "/fitra.png",
    organizerLogo: "/fitra-logo.png",
    participants: 600,
    maxParticipants: 600,
    registrationOpen: true,
    registrationDeadline: "August 3, 2026",
    rewards: {
      medal: {
        name: "Highland Conqueror Medal",
        description:
          "Heavy brass medal with mountain ridge engraving and 21K distance marker.",
      },
      eCertificate: {
        title: "Official Finisher's E-Certificate",
        description:
          "Digital certificate with your name, finishing time, elevation profile, and official race results.",
      },
      prizes: [
        "Premium performance shirt",
        "Top 3 overall: Trophy + ₱10,000 cash prize",
        "Top 3 per age group: Medals + gift packs",
      ],
    },
    registrationFee: 1500,
    cutoffTimeMinutes: 240,
    kitPickupInfo: "August 7–8, 2026 at Burnham Park Clubhouse, 8AM–5PM",
    inclusions: [
      "Medal",
      "T-Shirt",
      "E-Certificate",
      "Timing Chip",
      "Race Bib",
    ],
  },
  {
    id: "5",
    dbId: "a1b2c3d4-0005-4000-8000-000000000005",
    title: "Davao Durian Dash 5K",
    organizer: "Mindanao Runners",
    date: "September 13, 2026",
    time: "5:30 AM",
    location: "Davao City, Philippines",
    category: "5K",
    description:
      "A fun and fruity 5K run celebrating Davao's famous durian festival season.",
    fullDescription:
      "The Davao Durian Dash 5K is a unique themed run that celebrates Davao's iconic fruit. Runners pass through People's Park, Jack's Ridge, and the Durian Dome. The route is flat and beginner-friendly with durian-themed aid stations offering durian candies and shakes. Every finisher receives a quirky durian-shaped medal, event shirt, and a box of fresh durians. Fun run categories for kids and families available.",
    image: "/fitra.png",
    organizerLogo: "/fitra-logo.png",
    participants: 180,
    maxParticipants: 400,
    registrationOpen: true,
    registrationDeadline: "September 7, 2026",
    rewards: {
      medal: {
        name: "Durian Dash Medal",
        description:
          "Quirky durian-shaped finisher's medal — a collector's item for fun runners.",
      },
      eCertificate: {
        title: "Official Finisher's E-Certificate",
        description:
          "Digital certificate with your name, finishing time, and official race results. Downloadable and shareable.",
      },
      prizes: [
        "Event shirt for all finishers",
        "Box of fresh Davao durians",
        "Best durian costume: ₱2,000 gift certificate",
      ],
    },
    registrationFee: 0,
    cutoffTimeMinutes: 90,
    kitPickupInfo: "September 11–12, 2026 at People's Park Entrance, 8AM–5PM",
    inclusions: ["Medal", "T-Shirt", "E-Certificate", "Fresh Durians"],
  },
  {
    id: "6",
    dbId: "a1b2c3d4-0006-4000-8000-000000000006",
    title: "Subic Bay 10K Classic",
    organizer: "Freeport Runners Assoc.",
    date: "October 4, 2026",
    time: "5:00 AM",
    location: "Subic Bay, Philippines",
    category: "10K",
    description:
      "Run through the lush greenery and scenic bay views of the Subic Bay Freeport Zone.",
    fullDescription:
      "The Subic Bay 10K Classic offers one of the most scenic race routes in the Philippines. Starting at the Subic Bay Convention Center, runners pass through the jungle-lined roads, the historic Naval Magazine area, and finish with a stunning bayfront stretch. The clean air, flat terrain, and well-organized event make this a favorite among 10K enthusiasts. Includes chip timing, finisher's medal, race kit, and post-race brunch.",
    image: "/fitra.png",
    organizerLogo: "/fitra-logo.png",
    participants: 320,
    maxParticipants: 700,
    registrationOpen: true,
    registrationDeadline: "September 28, 2026",
    rewards: {
      medal: {
        name: "Bay Classic Medal",
        description:
          "Scenic bay-themed finisher's medal with a tropical design and 10K distance marker.",
      },
      eCertificate: {
        title: "Official Finisher's E-Certificate",
        description:
          "Digital certificate with your name, finishing time, and official race results. Downloadable and shareable.",
      },
      prizes: [
        "Race kit with tech shirt and visor",
        "Post-race brunch for all participants",
        "Top 3 per age group: Trophies + sponsor gifts",
      ],
    },
    registrationFee: 800,
    cutoffTimeMinutes: 120,
    kitPickupInfo: "October 2–3, 2026 at Subic Bay Convention Center, 9AM–5PM",
    inclusions: [
      "Medal",
      "T-Shirt",
      "E-Certificate",
      "Timing Chip",
      "Post-Race Brunch",
    ],
  },
];
