export interface RaceReward {
  medal: {
    name: string;
    description: string;
  };
  eCertificate: {
    title: string;
    description: string;
  };
  prizes?: string[];
}

export interface RaceEvent {
  id: string;
  dbId: string;
  title: string;
  organizer: string;
  date: string;
  time: string;
  location: string;
  /** organizer-pinned coordinates; absent when no pin was set */
  latitude?: number | null;
  longitude?: number | null;
  /** true when coordinates were geocoded from the location text, not pinned */
  approximateLocation?: boolean;
  category: "5K" | "10K" | "Half Marathon" | "Marathon";
  description: string;
  fullDescription: string;
  image: string;
  organizerLogo: string;
  participants: number;
  maxParticipants: number;
  registrationOpen: boolean;
  registrationDeadline: string;
  rewards: RaceReward;
  gpxUrl?: string;
  /** 0 = free, positive = fee in PHP */
  registrationFee?: number;
  /** cutoff time to finish the race, in minutes (e.g. 360 = 6 hrs) */
  cutoffTimeMinutes?: number;
  /** where/when runners collect their race kit */
  kitPickupInfo?: string;
  /** items included in registration (e.g. ["Medal", "T-Shirt", "E-Certificate"]) */
  inclusions?: string[];
}

export type RaceCategory = "All" | "5K" | "10K" | "Half Marathon" | "Marathon";
