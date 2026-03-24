import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from 'expo-font';
import { Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import type { Session, User } from '@supabase/supabase-js';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { appRedirectUrl, isSupabaseConfigured, supabase } from './lib/supabase';

type Role = 'player' | 'coach';
type Sport = 'soccer' | 'football' | 'tennis' | 'baseball' | 'basketball';
type Phase = 'welcome' | 'auth' | 'app';
type AuthMode = 'login' | 'register';
type Tab = 'explore' | 'messages' | 'profile';
type ExploreMode = 'players' | 'coaches' | 'filters' | 'trials' | 'offers' | 'postTrial' | 'postOffer';

const PRIVACY_POLICY_URL = 'https://paulaboza21.github.io/globalsportsid/privacy-policy.html';
const TERMS_OF_SERVICE_URL = 'https://paulaboza21.github.io/globalsportsid/terms-of-service.html';

type ProfileForm = {
  fullName: string;
  email: string;
  password: string;
  team: string;
  gender: string;
  nationality: string;
  age: string;
  city: string;
  country: string;
  position: string;
  avatar: string;
  highlights: string;
  stats: string;
  bio: string;
};

type PlayerFilters = {
  gender: string;
  ageFrom: string;
  ageTo: string;
  position: string;
  location: string;
};

type ListingLocationFilter = {
  query: string;
  selected: string;
};

type TrialDraft = {
  team: string;
  location: string;
  time: string;
  details: string;
  registrationLink: string;
};

type OfferDraft = {
  team: string;
  position: string;
  ageRange: string;
  details: string;
};

type ProfileRow = {
  id: string;
  role: Role;
  sport: Sport | null;
  full_name: string;
  email: string | null;
  team_name: string | null;
  gender: string | null;
  nationality: string | null;
  age: number | null;
  city: string | null;
  country: string | null;
  position: string | null;
  avatar_url: string | null;
  highlights_url: string | null;
  stats: string | null;
  bio: string | null;
};

type MessageEntry = {
  id?: string;
  from: 'them' | 'me';
  body: string;
  isRead?: boolean;
};

type ConversationThread = {
  id: string;
  name: string;
  preview: string;
  sport: Sport;
  messages: MessageEntry[];
  conversationId?: string;
  otherProfileId?: string;
  otherRole?: Role;
  pendingApproval?: boolean;
  unreadCount?: number;
  avatar?: string;
  team?: string;
  position?: string;
  age?: string;
};

type DirectConversationTarget = {
  profileId?: string;
  name: string;
  role?: Role;
  sport: Sport;
  avatar?: string;
  team?: string;
  position?: string;
  age?: string;
};

const isCrossRoleConversation = (currentRole: Role, otherRole?: Role) => {
  if (!otherRole) {
    return currentRole === 'player';
  }

  return otherRole !== currentRole;
};

const isVisibleConversationThread = (thread: ConversationThread, currentRole: Role) =>
  isCrossRoleConversation(currentRole, thread.otherRole);

type RequestThread = {
  id: string;
  name: string;
  text: string;
  sport: Sport;
  senderId?: string;
  otherRole?: Role;
  avatar?: string;
  team?: string;
  position?: string;
  age?: string;
};

type PlayerCard = {
  id: string;
  profileId?: string;
  sport: Sport;
  name: string;
  team: string;
  gender?: string;
  nationality: string;
  age: string;
  position: string;
  avatar?: string;
  highlights?: string;
  bio?: string;
  stats?: string;
  city?: string;
  country?: string;
};

type CoachCard = {
  id: string;
  profileId?: string;
  sport: Sport;
  name: string;
  team: string;
  location: string;
  bio: string;
  avatar?: string;
  trials: string[];
  offers: string[];
};

type TrialCard = {
  id: string;
  sport: Sport;
  coachName: string;
  team: string;
  time: string;
  location: string;
  description: string;
  registrationLink: string;
};

type OfferCard = {
  id: string;
  sport: Sport;
  coachName: string;
  coachProfileId?: string;
  team: string;
  title: string;
  details: string;
  target: string;
  location: string;
};

const colors = {
  bg: '#000000',
  bgDeep: '#000000',
  card: '#0D1B2A',
  cardElevated: '#122235',
  gold: '#D4AF37',
  goldSoft: '#E6C76A',
  goldDim: '#9B7A1F',
  text: '#FFFFFF',
  muted: '#B8C1CC',
  dark: '#0D1B2A',
  white: '#0D1B2A',
  pink: '#162238',
  border: '#243044',
  line: 'rgba(212, 175, 55, 0.25)',
};

const sports: Sport[] = ['soccer', 'football', 'tennis', 'baseball', 'basketball'];
const metallicGoldGradient: readonly [string, string, string, string, string] = [
  '#7A5A12',
  '#B98C24',
  '#F2DEA0',
  '#D4AF37',
  '#8A6818',
];

function formatOfferDetailsPayload(position: string, ageRange: string, details: string) {
  return [`POSITION: ${position.trim()}`, `AGE RANGE: ${ageRange.trim()}`, `DETAILS: ${details.trim()}`].join('\n');
}

function parseOfferDetailsPayload(details: string) {
  const lines = details.split('\n');
  const position = lines.find((line) => line.startsWith('POSITION: '))?.replace('POSITION: ', '').trim() ?? '';
  const ageRange = lines.find((line) => line.startsWith('AGE RANGE: '))?.replace('AGE RANGE: ', '').trim() ?? '';
  const detailLine = lines.find((line) => line.startsWith('DETAILS: '))?.replace('DETAILS: ', '').trim();

  return {
    position,
    ageRange,
    details: detailLine || details,
  };
}

function normalizeLocationValue(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

const worldCities = [
  'Sydney, Australia',
  'Melbourne, Australia',
  'Brisbane, Australia',
  'Perth, Australia',
  'Adelaide, Australia',
  'Auckland, New Zealand',
  'Wellington, New Zealand',
  'London, England',
  'Manchester, England',
  'Liverpool, England',
  'Birmingham, England',
  'Glasgow, Scotland',
  'Edinburgh, Scotland',
  'Dublin, Ireland',
  'Madrid, Spain',
  'Barcelona, Spain',
  'Valencia, Spain',
  'Seville, Spain',
  'Bilbao, Spain',
  'Lisbon, Portugal',
  'Porto, Portugal',
  'Paris, France',
  'Lyon, France',
  'Marseille, France',
  'Nice, France',
  'Berlin, Germany',
  'Munich, Germany',
  'Hamburg, Germany',
  'Frankfurt, Germany',
  'Rome, Italy',
  'Milan, Italy',
  'Naples, Italy',
  'Turin, Italy',
  'Amsterdam, Netherlands',
  'Rotterdam, Netherlands',
  'Brussels, Belgium',
  'Zurich, Switzerland',
  'Geneva, Switzerland',
  'Vienna, Austria',
  'Prague, Czech Republic',
  'Warsaw, Poland',
  'Copenhagen, Denmark',
  'Stockholm, Sweden',
  'Oslo, Norway',
  'Helsinki, Finland',
  'Athens, Greece',
  'Istanbul, Turkey',
  'Dubai, United Arab Emirates',
  'Doha, Qatar',
  'Riyadh, Saudi Arabia',
  'Cairo, Egypt',
  'Cape Town, South Africa',
  'Johannesburg, South Africa',
  'Lagos, Nigeria',
  'Nairobi, Kenya',
  'Mumbai, India',
  'Delhi, India',
  'Bengaluru, India',
  'Chennai, India',
  'Hyderabad, India',
  'Kolkata, India',
  'Singapore, Singapore',
  'Bangkok, Thailand',
  'Kuala Lumpur, Malaysia',
  'Jakarta, Indonesia',
  'Manila, Philippines',
  'Ho Chi Minh City, Vietnam',
  'Hanoi, Vietnam',
  'Hong Kong, Hong Kong',
  'Taipei, Taiwan',
  'Seoul, South Korea',
  'Tokyo, Japan',
  'Osaka, Japan',
  'Beijing, China',
  'Shanghai, China',
  'Shenzhen, China',
  'Guangzhou, China',
  'Mexico City, Mexico',
  'Guadalajara, Mexico',
  'Monterrey, Mexico',
  'Toronto, Canada',
  'Vancouver, Canada',
  'Montreal, Canada',
  'Calgary, Canada',
  'New York, USA',
  'Los Angeles, USA',
  'Chicago, USA',
  'Houston, USA',
  'Miami, USA',
  'Atlanta, USA',
  'Dallas, USA',
  'Seattle, USA',
  'Boston, USA',
  'San Francisco, USA',
  'Washington, USA',
  'Orlando, USA',
  'Phoenix, USA',
  'Denver, USA',
  'Buenos Aires, Argentina',
  'Cordoba, Argentina',
  'Santiago, Chile',
  'Lima, Peru',
  'Bogota, Colombia',
  'Medellin, Colombia',
  'Sao Paulo, Brazil',
  'Rio de Janeiro, Brazil',
  'Belo Horizonte, Brazil',
  'Curitiba, Brazil',
  'Montevideo, Uruguay',
] as const;
const worldCountries = [
  'Argentina',
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'Chile',
  'China',
  'Colombia',
  'Czech Republic',
  'Denmark',
  'Egypt',
  'England',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hong Kong',
  'India',
  'Indonesia',
  'Ireland',
  'Italy',
  'Japan',
  'Kenya',
  'Malaysia',
  'Mexico',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Norway',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Saudi Arabia',
  'Scotland',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'Taiwan',
  'Thailand',
  'Turkey',
  'United Arab Emirates',
  'Uruguay',
  'USA',
  'Vietnam',
] as const;
const worldNationalities = [
  'American',
  'Argentinian',
  'Australian',
  'Austrian',
  'Belgian',
  'Brazilian',
  'British',
  'Canadian',
  'Chilean',
  'Chinese',
  'Colombian',
  'Czech',
  'Danish',
  'Dutch',
  'Egyptian',
  'English',
  'Finnish',
  'French',
  'German',
  'Greek',
  'Hong Konger',
  'Indian',
  'Indonesian',
  'Irish',
  'Italian',
  'Japanese',
  'Kenyan',
  'Korean',
  'Malaysian',
  'Mexican',
  'New Zealander',
  'Nigerian',
  'Norwegian',
  'Philippine',
  'Polish',
  'Portuguese',
  'Qatari',
  'Saudi',
  'Scottish',
  'Singaporean',
  'South African',
  'Spanish',
  'Swedish',
  'Swiss',
  'Taiwanese',
  'Thai',
  'Turkish',
  'Uruguayan',
  'Vietnamese',
] as const;
const positions: Record<Sport, string[]> = {
  soccer: ['Goalkeeper', 'Defender', 'Midfielder', 'Winger', 'Striker'],
  football: ['Quarterback', 'Receiver', 'Running Back', 'Linebacker', 'Cornerback'],
  tennis: ['Singles', 'Doubles', 'All Court', 'Baseline', 'Serve and Volley'],
  baseball: ['Pitcher', 'Catcher', 'Infielder', 'Outfielder', 'Shortstop'],
  basketball: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
};

const playerCards: PlayerCard[] = [
  {
    id: 'player-paula-soccer',
    sport: 'soccer',
    name: 'PAULA BOZA',
    team: 'GEORGIA STATE UNIVERSITY',
    gender: 'female',
    nationality: 'SPANISH',
    age: '24',
    position: 'DEFENDER',
    highlights: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'Defender with university-level experience and strong one-versus-one defending.',
    stats: '5 GOALS | 3 ASSISTS | 20 GAMES',
  },
  {
    id: 'player-sara-soccer',
    sport: 'soccer',
    name: 'SARA LOPEZ',
    team: 'HILLS UNITED',
    gender: 'female',
    nationality: 'AMERICAN',
    age: '18',
    position: 'MIDFIELDER',
    highlights: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'Technical midfielder with high work rate and transition passing.',
    stats: '8 GOALS | 11 ASSISTS | 26 GAMES',
  },
  {
    id: 'player-maui-soccer',
    sport: 'soccer',
    name: 'MAUI PEREZ',
    team: 'INDIANA UNIVERSITY',
    gender: 'female',
    nationality: 'FRENCH',
    age: '21',
    position: 'GOALKEEPER',
    highlights: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'Goalkeeper focused on command of area, distribution, and shot stopping.',
    stats: '12 CLEAN SHEETS | 78 SAVES | 24 GAMES',
  },
  {
    id: 'player-luca-basketball',
    sport: 'basketball',
    name: 'LUCA PRICE',
    team: 'MELBOURNE ELITE',
    gender: 'male',
    nationality: 'AUSTRALIAN',
    age: '20',
    position: 'POINT GUARD',
    highlights: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'Fast guard with pace control and floor vision.',
    stats: '18 PPG | 9 AST | 31 GAMES',
  },
  {
    id: 'player-noah-baseball',
    sport: 'baseball',
    name: 'NOAH REYES',
    team: 'PACIFIC STATE',
    gender: 'male',
    nationality: 'MEXICAN',
    age: '19',
    position: 'PITCHER',
    highlights: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'Pitcher with velocity upside and durable mechanics.',
    stats: '2.11 ERA | 94 K | 16 STARTS',
  },
  {
    id: 'player-erin-tennis',
    sport: 'tennis',
    name: 'ERIN COLE',
    team: 'ACADEMY EUROPE',
    gender: 'female',
    nationality: 'BRITISH',
    age: '21',
    position: 'SINGLES',
    highlights: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'Singles specialist with aggressive baseline play.',
    stats: '24 WINS | 6 LOSSES | 5 TITLES',
  },
  {
    id: 'player-mason-football',
    sport: 'football',
    name: 'MASON RUIZ',
    team: 'TEXAS PREP',
    gender: 'male',
    nationality: 'AMERICAN',
    age: '18',
    position: 'QUARTERBACK',
    highlights: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'Quarterback with strong arm talent and composure under pressure.',
    stats: '37 TD | 3,900 YDS | 13 GAMES',
  },
];

const mockCoachCards: CoachCard[] = [
  {
    id: 'allan',
    sport: 'soccer',
    name: 'COACH ALLAN',
    team: 'HILLS UNITED',
    location: 'SYDNEY, AUSTRALIA',
    bio: 'Head coach focused on disciplined possession football and strong defender development.',
    trials: [
      'HILLS UNITED TRIAL | 7 PM | VALENTINES SPORTS COMPLEX',
      'DEFENDER & MIDFIELDER EVALUATION | REGISTER ONLINE',
    ],
    offers: [
      'FULL SCHOLARSHIP TRACK FOR DEFENDERS',
      'LOOKING FOR FEMALE PLAYERS 18-23',
    ],
  },
  {
    id: 'reese',
    sport: 'soccer',
    name: 'COACH REESE',
    team: 'SPITI FC',
    location: 'MUMBAI, INDIA',
    bio: 'Technical development coach building competitive youth and senior pathways.',
    trials: [
      'SPITI FC TRIAL | 12 PM | ERYUL STADIUM',
      'CENTER BACK & WINGER OPEN CALL',
    ],
    offers: [
      'TRAVEL SUPPORT PACKAGE AVAILABLE',
      'LOOKING FOR MALE PLAYERS 16-20',
    ],
  },
];

const trialCards: TrialCard[] = [
  {
    id: 'trial-allan',
    sport: 'soccer',
    coachName: 'COACH ALLAN',
    team: 'HILLS UNITED TRIAL',
    time: '7 PM',
    location: 'VALENTINES SPORTS COMPLEX',
    description: 'Open evaluation for defenders and midfielders. Bring recent footage, training kit, and availability for follow-up sessions.',
    registrationLink: 'https://globalsportsid.com/trials/hills-united',
  },
  {
    id: 'trial-reese',
    sport: 'soccer',
    coachName: 'COACH REESE',
    team: 'SPITI FC TRIAL',
    time: '12 PM',
    location: 'ERYUL STADIUM',
    description: 'Center back and winger assessment with technical drills, small-sided games, and scholarship review.',
    registrationLink: 'https://globalsportsid.com/trials/spiti-fc',
  },
];

const offerCards: OfferCard[] = [
  {
    id: 'offer-allan',
    sport: 'soccer',
    coachName: 'COACH ALLAN',
    coachProfileId: 'allan',
    team: 'HILLS UNITED',
    title: 'SCHOLARSHIP OFFER',
    details: 'Looking for a female midfielder between 18 and 23 with strong game intelligence, recent highlight footage, and university eligibility.',
    target: 'FEMALE MIDFIELDER | 18-23',
    location: 'SYDNEY, AUSTRALIA',
  },
  {
    id: 'offer-reese',
    sport: 'soccer',
    coachName: 'COACH REESE',
    coachProfileId: 'reese',
    team: 'SPITI FC',
    title: 'TRAVEL SUPPORT OFFER',
    details: 'Seeking male defenders and wingers for an international pathway program with travel support and trial-to-contract progression.',
    target: 'MALE DEFENDER / WINGER | 16-20',
    location: 'MUMBAI, INDIA',
  },
];

const initialMessages: ConversationThread[] = [
  {
    id: 'allan-chat',
    name: 'COACH ALLAN',
    preview: 'Hello, I am looking for a defender to join my team',
    sport: 'soccer',
    otherRole: 'coach',
    messages: [
      { from: 'them', body: 'Hello, I am looking for a defender to join my team.' },
      { from: 'me', body: 'Hi coach, I am interested and can send my full highlights.' },
      { from: 'them', body: 'Perfect. Send your latest video and availability for a call.' },
    ],
  },
  {
    id: 'zaira-chat',
    name: 'COACH ZAIRA',
    preview: 'Hello, I am looking for a defender to join my team',
    sport: 'soccer',
    otherRole: 'coach',
    messages: [
      { from: 'them', body: 'We are recruiting defenders for next season.' },
      { from: 'me', body: 'I would love to hear more about the opportunity.' },
    ],
  },
  {
    id: 'ell-chat',
    name: 'COACH ELL',
    preview: 'Hello, I am looking for a defender to join my team',
    sport: 'soccer',
    otherRole: 'coach',
    messages: [
      { from: 'them', body: 'Can you share your recent match clips and your current club?' },
    ],
  },
];

const messages = initialMessages;

const initialRequestItems: RequestThread[] = [
  {
    id: 'req-1',
    name: 'COACH ALLAN',
    text: 'Requested contact regarding your profile and latest highlights.',
    sport: 'soccer',
  },
  {
    id: 'req-2',
    name: 'COACH REESE',
    text: 'Would like to discuss a trial invitation for Hills United.',
    sport: 'soccer',
  },
  {
    id: 'req-3',
    name: 'COACH ZAIRA',
    text: 'Sent a message request about a scholarship opportunity.',
    sport: 'soccer',
  },
];

const emptyForm: ProfileForm = {
  fullName: '',
  email: '',
  password: '',
  team: '',
  gender: '',
  nationality: '',
  age: '',
  city: '',
  country: '',
  position: '',
  avatar: '',
  highlights: '',
  stats: '',
  bio: '',
};

const emptyPlayerFilters: PlayerFilters = {
  gender: '',
  ageFrom: '',
  ageTo: '',
  position: '',
  location: '',
};

const emptyListingLocationFilter: ListingLocationFilter = {
  query: '',
  selected: '',
};

const emptyTrialDraft: TrialDraft = {
  team: '',
  location: '',
  time: '',
  details: '',
  registrationLink: '',
};

const emptyOfferDraft: OfferDraft = {
  team: '',
  position: '',
  ageRange: '',
  details: '',
};

const statsFieldConfig: Record<Sport, { placeholder: string }> = {
  soccer: {
    placeholder: 'e.g. 5 GOALS | 3 ASSISTS | 20 GAMES',
  },
  football: {
    placeholder: 'e.g. 220 PASS YDS | 3 TD | 1 INT',
  },
  basketball: {
    placeholder: 'e.g. 18 PPG | 9 AST | 6 REB',
  },
  baseball: {
    placeholder: 'e.g. .318 AVG | 12 HR | 34 RBI',
  },
  tennis: {
    placeholder: 'e.g. 24 WINS | 6 LOSSES | 5 TITLES',
  },
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    PlayfairDisplay_700Bold,
  });
  const [phase, setPhase] = useState<Phase>('welcome');
  const [role, setRole] = useState<Role>('player');
  const [sport, setSport] = useState<Sport>('soccer');
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [tab, setTab] = useState<Tab>('explore');
  const [exploreMode, setExploreMode] = useState<ExploreMode>('players');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [conversationThreads, setConversationThreads] = useState(initialMessages);
  const [requestThreads, setRequestThreads] = useState(initialRequestItems);
  const [playerProfiles, setPlayerProfiles] = useState<PlayerCard[]>(playerCards);
  const [coachProfiles, setCoachProfiles] = useState<CoachCard[]>(mockCoachCards);
  const [trialListings, setTrialListings] = useState<TrialCard[]>(trialCards);
  const [offerListings, setOfferListings] = useState<OfferCard[]>(offerCards);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [requestActionBusyId, setRequestActionBusyId] = useState<string | null>(null);
  const [messagingRefreshKey, setMessagingRefreshKey] = useState(0);
  const [playerFilterDraft, setPlayerFilterDraft] = useState<PlayerFilters>(emptyPlayerFilters);
  const [activePlayerFilters, setActivePlayerFilters] = useState<PlayerFilters>(emptyPlayerFilters);
  const [showCoachFilters, setShowCoachFilters] = useState(false);
  const [trialDraft, setTrialDraft] = useState<TrialDraft>(emptyTrialDraft);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(emptyOfferDraft);
  const [trialLocationFilter, setTrialLocationFilter] = useState<ListingLocationFilter>(emptyListingLocationFilter);
  const [offerLocationFilter, setOfferLocationFilter] = useState<ListingLocationFilter>(emptyListingLocationFilter);
  const [trialPostLocationFilter, setTrialPostLocationFilter] = useState<ListingLocationFilter>(emptyListingLocationFilter);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      if (!isSupabaseConfigured) {
        setLoadingSession(false);
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(window.location.search);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const recoveryType = hashParams.get('type');
        const authError =
          hashParams.get('error_description') ||
          hashParams.get('error') ||
          searchParams.get('error_description') ||
          searchParams.get('error');

        if (authError && isMounted) {
          const decodedError = decodeURIComponent(authError.replace(/\+/g, ' '));
          const friendlyError = /expired|invalid/i.test(decodedError)
            ? 'This password reset link is invalid or has expired. Please request a new one.'
            : decodedError;

          setIsPasswordRecovery(false);
          setAuthMode('login');
          setPhase('auth');
          setAuthError(friendlyError);
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        } else if (accessToken && refreshToken) {
          const { data: recoveryData, error: recoveryError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (recoveryError) {
            console.error('recovery session error', recoveryError);
            Alert.alert('Recovery error', recoveryError.message);
          } else if (isMounted) {
            if (recoveryType === 'recovery') {
              setIsPasswordRecovery(true);
              setPhase('auth');
              setAuthMode('login');
              setAuthError('');
              setForm((current) => ({ ...current, password: '' }));
            }

            setSession(recoveryData.session ?? null);
          }

          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
      }

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('getSession error', error);
        Alert.alert('Session error', error.message);
      }

      if (!isMounted) {
        return;
      }

      setSession(data.session ?? null);
      setLoadingSession(false);
    };

    restoreSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (isMounted) {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          setPhase('auth');
          setAuthMode('login');
          setAuthError('');
          setForm((current) => ({ ...current, password: '' }));
        }

        setSession(nextSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || isPasswordRecovery) {
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      setProfileBusy(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle<ProfileRow>();

      if (!isMounted) {
        return;
      }

      if (error) {
        setProfileBusy(false);
        console.error('loadProfile error', error);
        Alert.alert('Profile error', error.message);
        return;
      }

      if (data) {
        if (phase === 'auth' && data.role !== role) {
          await rejectWrongRoleAccess(data.role);
          return;
        }

        hydrateFromProfile(data);
        setPhase('app');
      }

      setProfileBusy(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isPasswordRecovery, phase, role, session]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    const loadPlayerProfiles = async () => {
      const { data: players, error } = await supabase
        .from('profiles')
        .select('id, full_name, team_name, gender, nationality, age, position, avatar_url, highlights_url, bio, stats, city, country, sport')
        .eq('role', 'player')
        .eq('sport', sport)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('load players error', error);
        return;
      }

      if (!players?.length || !isMounted) {
        setPlayerProfiles(playerCards.filter((player) => player.sport === sport));
        return;
      }

      setPlayerProfiles(
        players.map((player) => ({
          id: player.id,
          profileId: player.id,
          sport: (player.sport as Sport) || 'soccer',
          name: (player.full_name || 'PLAYER').toUpperCase(),
          team: (player.team_name || 'TEAM').toUpperCase(),
          gender: player.gender || '',
          nationality: (player.nationality || '').toUpperCase(),
          age: player.age ? String(player.age) : '',
          position: (player.position || '').toUpperCase(),
          avatar: player.avatar_url || undefined,
          highlights: player.highlights_url || undefined,
          bio: player.bio || undefined,
          stats: player.stats || undefined,
          city: player.city || undefined,
          country: player.country || undefined,
        })),
      );
    };

    const loadCoachProfiles = async () => {
      const { data: coaches, error: coachError } = await supabase
        .from('profiles')
        .select('id, full_name, team_name, city, country, bio, avatar_url, sport')
        .eq('role', 'coach')
        .eq('sport', sport)
        .order('created_at', { ascending: false });

      if (coachError) {
        console.error('load coaches error', coachError);
        return;
      }

      if (!coaches?.length || !isMounted) {
        setCoachProfiles(mockCoachCards.filter((coach) => coach.sport === sport));
        setTrialListings(trialCards.filter((trial) => trial.sport === sport));
        setOfferListings(offerCards.filter((offer) => offer.sport === sport));
        return;
      }

      const coachIds = coaches.map((coach) => coach.id);
      const { data: trialRows } = await supabase
        .from('trials')
        .select('id, coach_id, team_name, event_time, location_text, description, registration_link')
        .eq('sport', sport)
        .in('coach_id', coachIds);
      const { data: offerRows } = await supabase
        .from('offers')
        .select('id, coach_id, team_name, details')
        .eq('sport', sport)
        .in('coach_id', coachIds);

      const trialsByCoach = new Map<string, string[]>();
      for (const row of trialRows ?? []) {
        const current = trialsByCoach.get(row.coach_id) ?? [];
        current.push(`${row.team_name} | ${row.event_time} | ${row.location_text} | ${row.description}`);
        trialsByCoach.set(row.coach_id, current);
      }

      const offersByCoach = new Map<string, string[]>();
      for (const row of offerRows ?? []) {
        const current = offersByCoach.get(row.coach_id) ?? [];
        current.push(`${row.team_name} | ${row.details}`);
        offersByCoach.set(row.coach_id, current);
      }

      const coachNameMap = new Map(
        coaches.map((coach) => [coach.id, (coach.full_name || 'COACH').toUpperCase()]),
      );
      const coachLocationMap = new Map(
        coaches.map((coach) => [coach.id, [coach.city, coach.country].filter(Boolean).join(', ').toUpperCase() || 'LOCATION']),
      );

      setTrialListings(
        trialRows?.length
          ? trialRows.map((row) => ({
              id: row.id,
              sport: ((coaches.find((coach) => coach.id === row.coach_id)?.sport as Sport) || sport),
              coachName: coachNameMap.get(row.coach_id) || 'COACH',
              team: row.team_name,
              time: row.event_time,
              location: row.location_text,
              description: row.description,
              registrationLink: row.registration_link || '',
            }))
          : trialCards.filter((trial) => trial.sport === sport),
      );

      setOfferListings(
        offerRows?.length
          ? offerRows.map((row) => {
              const parsed = parseOfferDetailsPayload(row.details);

              return {
                id: row.id,
                sport: ((coaches.find((coach) => coach.id === row.coach_id)?.sport as Sport) || sport),
                coachName: coachNameMap.get(row.coach_id) || 'COACH',
                coachProfileId: row.coach_id,
                team: row.team_name,
                title: 'COACH OFFER',
                details: parsed.details,
                target: [parsed.position, parsed.ageRange].filter(Boolean).join(' | ') || 'OPEN PLAYER SEARCH',
                location: coachLocationMap.get(row.coach_id) || 'LOCATION',
              };
            })
          : offerCards.filter((offer) => offer.sport === sport),
      );

      setCoachProfiles(
        coaches.map((coach) => ({
          id: coach.id,
          profileId: coach.id,
          sport: (coach.sport as Sport) || 'soccer',
          name: (coach.full_name || 'COACH').toUpperCase(),
          team: coach.team_name || 'TEAM',
          location: [coach.city, coach.country].filter(Boolean).join(', ').toUpperCase() || 'LOCATION',
          bio: coach.bio || 'Coach profile coming soon.',
          avatar: coach.avatar_url || undefined,
          trials: trialsByCoach.get(coach.id) ?? [],
          offers: offersByCoach.get(coach.id) ?? [],
        })),
      );
    };

    loadPlayerProfiles();
    loadCoachProfiles();

    return () => {
      isMounted = false;
    };
  }, [session, sport]);

  useEffect(() => {
    if (form.position && !positions[sport].includes(form.position)) {
      setForm((current) => ({ ...current, position: '' }));
    }

    if (playerFilterDraft.position && !positions[sport].includes(playerFilterDraft.position)) {
      setPlayerFilterDraft((current) => ({ ...current, position: '' }));
    }

    if (activePlayerFilters.position && !positions[sport].includes(activePlayerFilters.position)) {
      setActivePlayerFilters((current) => ({ ...current, position: '' }));
    }
  }, [activePlayerFilters.position, form.position, playerFilterDraft.position, sport]);

  useEffect(() => {
    if (!session?.user || !isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    const loadMessagingData = async () => {
      const userId = session.user.id;

      const { data: requestRows, error: requestError } = await supabase
        .from('contact_requests')
        .select('id, sender_id, note')
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestError) {
        console.error('load requests error', requestError);
      }

      if (!isMounted) {
        return;
      }

      if (requestRows?.length) {
        const senderIds = [...new Set(requestRows.map((row) => row.sender_id))];
        const { data: senders } = await supabase
          .from('profiles')
          .select('id, full_name, role, sport, team_name, age, position, avatar_url')
          .in('id', senderIds);
        const senderMap = new Map((senders ?? []).map((row) => [row.id, row]));

        setRequestThreads(
          requestRows.map((row) => ({
            id: row.id,
            name: (senderMap.get(row.sender_id)?.full_name || 'CONTACT REQUEST').toUpperCase(),
            text: row.note || 'Would like to start a conversation with you.',
            sport: (senderMap.get(row.sender_id)?.sport as Sport) || sport,
            senderId: row.sender_id,
            otherRole: senderMap.get(row.sender_id)?.role as Role | undefined,
            avatar: senderMap.get(row.sender_id)?.avatar_url || undefined,
            team: senderMap.get(row.sender_id)?.team_name || undefined,
            position: senderMap.get(row.sender_id)?.position || undefined,
            age: senderMap.get(row.sender_id)?.age ? String(senderMap.get(row.sender_id)?.age) : undefined,
          })),
        );
      } else {
        setRequestThreads([]);
      }

      const { data: outgoingRequestRows, error: outgoingRequestError } = await supabase
        .from('contact_requests')
        .select('id, receiver_id, note')
        .eq('sender_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (outgoingRequestError) {
        console.error('load outgoing requests error', outgoingRequestError);
      }

      const { data: membershipRows, error: membershipError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('profile_id', userId);

      if (membershipError) {
        console.error('load memberships error', membershipError);
      }
      const outgoingReceiverIds = [...new Set((outgoingRequestRows ?? []).map((row) => row.receiver_id))];
      const conversationIds = membershipRows?.map((row) => row.conversation_id) ?? [];
      const { data: memberRows } =
        conversationIds.length > 0
          ? await supabase
              .from('conversation_members')
              .select('conversation_id, profile_id')
              .in('conversation_id', conversationIds)
              .neq('profile_id', userId)
          : { data: [] };
      const otherIds = [...new Set((memberRows ?? []).map((row) => row.profile_id))];
      const { data: otherProfiles } =
        otherIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, full_name, role, sport, team_name, age, position, avatar_url')
              .in('id', otherIds)
          : { data: [] };
      const { data: outgoingProfiles } =
        outgoingReceiverIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, full_name, role, sport, team_name, age, position, avatar_url')
              .in('id', outgoingReceiverIds)
          : { data: [] };
      const profileMap = new Map((otherProfiles ?? []).map((row) => [row.id, row]));
      const outgoingProfileMap = new Map((outgoingProfiles ?? []).map((row) => [row.id, row]));
      const conversationToOther = new Map((memberRows ?? []).map((row) => [row.conversation_id, row.profile_id]));

      if (!isMounted) {
        return;
      }

      const { data: messageRows, error: messageError } =
        conversationIds.length > 0
          ? await supabase
              .from('messages')
              .select('id, conversation_id, sender_id, body, is_read, created_at')
              .in('conversation_id', conversationIds)
              .order('created_at', { ascending: true })
          : { data: [], error: null };

      if (messageError) {
        console.error('load messages error', messageError);
      }

      if (!isMounted || !messageRows) {
        return;
      }

      const grouped = new Map<string, typeof messageRows>();
      for (const row of messageRows) {
        const current = grouped.get(row.conversation_id) ?? [];
        current.push(row);
        grouped.set(row.conversation_id, current);
      }

      const remoteThreads: ConversationThread[] = conversationIds.map((conversationId) => {
        const rows = grouped.get(conversationId) ?? [];
        const otherProfileId = conversationToOther.get(conversationId);
        const otherProfile = otherProfileId ? profileMap.get(otherProfileId) : null;
        const name = otherProfile?.full_name || 'CONVERSATION';
        const preview = rows.at(-1)?.body || 'Start your conversation';
        const unreadCount = rows.filter((row) => row.sender_id !== userId && !row.is_read).length;

        return {
          id: conversationId,
          conversationId,
          otherProfileId,
          otherRole: otherProfile?.role as Role | undefined,
          sport: (otherProfile?.sport as Sport) || sport,
          name: name.toUpperCase(),
          preview,
          avatar: otherProfile?.avatar_url || undefined,
          team: otherProfile?.team_name || undefined,
          position: otherProfile?.position || undefined,
          age: otherProfile?.age ? String(otherProfile.age) : undefined,
          messages: rows.map((row) => ({
            id: row.id,
            from: row.sender_id === userId ? 'me' : 'them',
            body: row.body,
            isRead: row.sender_id === userId ? true : !!row.is_read,
          })),
          unreadCount,
        };
      });

      const connectedProfileIds = new Set(remoteThreads.map((thread) => thread.otherProfileId).filter(Boolean));
      const pendingOutgoingThreads: ConversationThread[] = (outgoingRequestRows ?? [])
        .filter((row) => !connectedProfileIds.has(row.receiver_id))
        .map((row) => {
        const receiver = outgoingProfileMap.get(row.receiver_id);
        const note = row.note || 'Contact request sent. Waiting for acceptance.';

        return {
          id: `request-${row.id}`,
          name: (receiver?.full_name || 'CONTACT REQUEST').toUpperCase(),
          preview: 'Pending contact request',
          sport: (receiver?.sport as Sport) || sport,
          otherRole: receiver?.role as Role | undefined,
          avatar: receiver?.avatar_url || undefined,
          team: receiver?.team_name || undefined,
          position: receiver?.position || undefined,
          age: receiver?.age ? String(receiver.age) : undefined,
          messages: [{ from: 'me', body: note, isRead: true }],
          otherProfileId: row.receiver_id,
          pendingApproval: true,
          unreadCount: 0,
        };
        });

      const nextThreads = [...pendingOutgoingThreads, ...remoteThreads];

      setConversationThreads(
        nextThreads.length
          ? nextThreads.filter((thread) => isVisibleConversationThread(thread, role))
          : initialMessages.filter((thread) => thread.sport === sport && isVisibleConversationThread(thread, role)),
      );
    };

    loadMessagingData();

    return () => {
      isMounted = false;
    };
  }, [messagingRefreshKey, role, session, sport]);

  const modeOptions = useMemo(
    () =>
      role === 'coach'
        ? [
            ['players', 'PLAYERS'],
            ['postTrial', 'POST A TRIAL'],
            ['postOffer', 'POST AN OFFER'],
          ]
        : [
            ['players', 'PLAYERS'],
            ['coaches', 'COACHES'],
            ['trials', 'FIND TRIALS'],
            ['offers', 'FIND OFFERS'],
          ],
    [role],
  );

  useEffect(() => {
    if (exploreMode === 'filters') {
      setExploreMode('players');
    }
  }, [exploreMode]);

  const filteredPlayers = useMemo(() => {
    const draft = activePlayerFilters;

    return playerProfiles.filter((player) => {
      if (player.sport !== sport) {
        return false;
      }

      if (draft.gender && (player.gender || '').toLowerCase() !== draft.gender.toLowerCase()) {
        return false;
      }

      const numericAge = Number(player.age || 0);
      if (draft.ageFrom && (!numericAge || numericAge < Number(draft.ageFrom))) {
        return false;
      }

      if (draft.ageTo && (!numericAge || numericAge > Number(draft.ageTo))) {
        return false;
      }

      if (draft.position && player.position !== draft.position.toUpperCase()) {
        return false;
      }

      if (draft.location) {
        const locationText = [player.city, player.country].filter(Boolean).join(', ').toLowerCase();
        if (!locationText.includes(draft.location.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [activePlayerFilters, playerProfiles, sport]);
  const filteredCoaches = useMemo(() => coachProfiles.filter((coach) => coach.sport === sport), [coachProfiles, sport]);
  const filteredTrials = useMemo(
    () =>
      trialListings.filter((trial) => {
        if (trial.sport !== sport) {
          return false;
        }

        if (!trialLocationFilter.selected) {
          return true;
        }

        return normalizeLocationValue(trial.location) === normalizeLocationValue(trialLocationFilter.selected);
      }),
    [sport, trialListings, trialLocationFilter.selected],
  );
  const filteredOffers = useMemo(
    () =>
      offerListings.filter((offer) => {
        if (offer.sport !== sport) {
          return false;
        }

        if (!offerLocationFilter.selected) {
          return true;
        }

        return normalizeLocationValue(offer.location) === normalizeLocationValue(offerLocationFilter.selected);
      }),
    [offerListings, offerLocationFilter.selected, sport],
  );
  const filteredConversations = useMemo(
    () =>
      conversationThreads.filter((thread) => {
        if (thread.sport !== sport) {
          return false;
        }

        if (!isVisibleConversationThread(thread, role)) {
          return false;
        }

        if (!conversationSearch.trim()) {
          return true;
        }

        const query = conversationSearch.trim().toLowerCase();
        return thread.name.toLowerCase().includes(query) || thread.preview.toLowerCase().includes(query);
      }),
    [conversationSearch, conversationThreads, role, sport],
  );
  const filteredRequests = useMemo(() => requestThreads.filter((request) => request.sport === sport), [requestThreads, sport]);
  const locationSuggestions = useMemo(() => {
    const query = playerFilterDraft.location.trim().toLowerCase();

    if (!query) {
      return [];
    }

    const profileLocations = playerProfiles
      .map((player) => [player.city, player.country].filter(Boolean).join(', '))
      .filter(Boolean);

    return [...new Set([...profileLocations, ...worldCities])]
      .filter((city) => city.toLowerCase().includes(query))
      .slice(0, 8);
  }, [playerFilterDraft.location, playerProfiles]);

  const trialLocationSuggestions = useMemo(() => {
    const query = trialLocationFilter.query.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return [...new Set([...trialListings.map((trial) => trial.location).filter(Boolean), ...worldCities])]
      .filter((location) => location.toLowerCase().includes(query))
      .slice(0, 8);
  }, [trialListings, trialLocationFilter.query]);

  const offerLocationSuggestions = useMemo(() => {
    const query = offerLocationFilter.query.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return [...new Set([...offerListings.map((offer) => offer.location).filter(Boolean), ...worldCities])]
      .filter((location) => location.toLowerCase().includes(query))
      .slice(0, 8);
  }, [offerListings, offerLocationFilter.query]);

  const trialPostLocationSuggestions = useMemo(() => {
    const query = trialPostLocationFilter.query.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return [...new Set([...trialListings.map((trial) => trial.location).filter(Boolean), ...worldCities])]
      .filter((location) => location.toLowerCase().includes(query))
      .slice(0, 8);
  }, [trialListings, trialPostLocationFilter.query]);

  const citySuggestions = useMemo(() => {
    const query = form.city.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return worldCities.filter((city) => city.toLowerCase().includes(query)).slice(0, 8);
  }, [form.city]);

  const countrySuggestions = useMemo(() => {
    const query = form.country.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return worldCountries.filter((country) => country.toLowerCase().includes(query)).slice(0, 8);
  }, [form.country]);

  const nationalitySuggestions = useMemo(() => {
    const query = form.nationality.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return worldNationalities.filter((nationality) => nationality.toLowerCase().includes(query)).slice(0, 8);
  }, [form.nationality]);

  useEffect(() => {
    if (selectedPlayerId && !filteredPlayers.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(null);
    }

    if (selectedConversationId && !filteredConversations.some((thread) => thread.id === selectedConversationId)) {
      setSelectedConversationId(null);
    }

    if (selectedCoachId && !filteredCoaches.some((coach) => coach.id === selectedCoachId)) {
      setSelectedCoachId(null);
    }

    if (selectedTrialId && !filteredTrials.some((trial) => trial.id === selectedTrialId)) {
      setSelectedTrialId(null);
    }

    if (selectedOfferId && !filteredOffers.some((offer) => offer.id === selectedOfferId)) {
      setSelectedOfferId(null);
    }
  }, [filteredCoaches, filteredConversations, filteredOffers, filteredPlayers, filteredTrials, selectedCoachId, selectedConversationId, selectedOfferId, selectedPlayerId, selectedTrialId]);

  const handleSwipeBack = () => {
    if (phase === 'auth') {
      setPhase('welcome');
      return;
    }

    if (phase === 'app') {
      if (tab !== 'explore') {
        if (tab === 'messages' && selectedConversationId) {
          setSelectedConversationId(null);
          return;
        }

        if (tab === 'messages' && showRequests) {
          setShowRequests(false);
          return;
        }

        setTab('explore');
        return;
      }

      const defaultExploreMode: ExploreMode = role === 'coach' ? 'players' : 'players';

      if (exploreMode !== defaultExploreMode) {
        setExploreMode(defaultExploreMode);
        setSelectedCoachId(null);
        setSelectedTrialId(null);
        setSelectedOfferId(null);
        return;
      }

      if (selectedCoachId) {
        setSelectedCoachId(null);
        return;
      }

      if (selectedTrialId) {
        setSelectedTrialId(null);
        return;
      }

      if (selectedOfferId) {
        setSelectedOfferId(null);
      }
    }
  };

  const swipeBackResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dx) > 24 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx > 80) {
            handleSwipeBack();
          }
        },
      }),
    [exploreMode, phase, role, selectedCoachId, selectedConversationId, selectedOfferId, selectedTrialId, showRequests, tab],
  );

  const hydrateFromProfile = (profile: ProfileRow) => {
    setRole(profile.role);
    setSport((profile.sport as Sport) || 'soccer');
    setTab('explore');
    setExploreMode(profile.role === 'coach' ? 'players' : 'coaches');
    setSelectedCoachId(null);
    setSelectedTrialId(null);
    setSelectedOfferId(null);
    setSelectedConversationId(null);
    setShowRequests(false);
    setIsEditingProfile(false);
    setForm({
      fullName: profile.full_name ?? '',
      email: profile.email ?? session?.user.email ?? '',
      password: '',
      team: profile.team_name ?? '',
      gender: profile.gender ?? '',
      nationality: profile.nationality ?? '',
      age: profile.age ? String(profile.age) : '',
      city: profile.city ?? '',
      country: profile.country ?? '',
      position: profile.position ?? '',
      avatar: profile.avatar_url ?? '',
      highlights: profile.role === 'player' ? profile.highlights_url ?? '' : '',
      stats: profile.stats ?? '',
      bio: profile.bio ?? '',
    });
  };

  const buildProfilePayload = (user: User, selectedRole: Role, selectedSport: Sport, sourceForm: ProfileForm) => {
    const metadata = (user.user_metadata || {}) as Record<string, unknown>;
    const metadataAge =
      typeof metadata.age === 'number'
        ? metadata.age
        : typeof metadata.age === 'string' && metadata.age.trim()
          ? Number(metadata.age)
          : null;

    return {
      id: user.id,
      role: selectedRole,
      sport: selectedSport,
      full_name:
        sourceForm.fullName.trim() ||
        (typeof metadata.full_name === 'string' ? metadata.full_name : '') ||
        user.email?.split('@')[0] ||
        'GLOBAL SPORTS USER',
      email: user.email || sourceForm.email.trim() || null,
      team_name: sourceForm.team.trim() || (typeof metadata.team_name === 'string' ? metadata.team_name : null),
      gender: sourceForm.gender.trim() || (typeof metadata.gender === 'string' ? metadata.gender : null),
      nationality:
        sourceForm.nationality.trim() || (typeof metadata.nationality === 'string' ? metadata.nationality : null),
      age: sourceForm.age ? Number(sourceForm.age) : metadataAge,
      city: sourceForm.city.trim() || (typeof metadata.city === 'string' ? metadata.city : null),
      country: sourceForm.country.trim() || (typeof metadata.country === 'string' ? metadata.country : null),
      position: sourceForm.position.trim() || (typeof metadata.position === 'string' ? metadata.position : null),
      avatar_url: sourceForm.avatar.trim() || (typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null),
      highlights_url:
        selectedRole === 'player'
          ? sourceForm.highlights.trim() || (typeof metadata.highlights_url === 'string' ? metadata.highlights_url : null)
          : null,
      stats: sourceForm.stats.trim() || (typeof metadata.stats === 'string' ? metadata.stats : null),
      bio: sourceForm.bio.trim() || (typeof metadata.bio === 'string' ? metadata.bio : null),
    };
  };

  const ensureProfileRecord = async (
    user: User,
    selectedRole: Role,
    selectedSport: Sport,
    sourceForm: ProfileForm = form,
  ) => {
    const payload = buildProfilePayload(user, selectedRole, selectedSport, sourceForm);
    const { data, error } = await supabase.from('profiles').upsert(payload).select('*').single<ProfileRow>();

    if (error) {
      console.error('ensureProfileRecord error', error);
      return { profile: null, error };
    }

    return { profile: data, error: null };
  };

  const persistProfile = async (selectedSport: Sport = sport) => {
    if (!session?.user) {
      Alert.alert('Not signed in', 'Create or restore a session first.');
      return false;
    }

    setProfileBusy(true);
    const { error } = await ensureProfileRecord(session.user, role, selectedSport, form);

    setProfileBusy(false);

    if (error) {
      Alert.alert('Save failed', error.message);
      return false;
    }

    return true;
  };

  const completeAppEntry = () => {
    setTab('explore');
    setExploreMode(role === 'coach' ? 'players' : 'coaches');
    setSelectedCoachId(null);
    setSelectedTrialId(null);
    setSelectedOfferId(null);
    setSelectedConversationId(null);
    setShowRequests(false);
    setPhase('app');
  };

  const validateProfileRequirements = (selectedRole: Role, sourceForm: ProfileForm, isRegistration = false) => {
    if (!sourceForm.email.trim() || !sourceForm.password.trim()) {
      return 'Email and password are required.';
    }

    if (!emailPattern.test(sourceForm.email.trim())) {
      return 'Enter a valid email address.';
    }

    if (isRegistration && !sourceForm.fullName.trim()) {
      return 'Full name is required for registration.';
    }

    if (selectedRole === 'player') {
      if (!sourceForm.fullName.trim()) {
        return 'Full name is required for player accounts.';
      }

      if (!sourceForm.gender.trim()) {
        return 'Gender is required for player accounts.';
      }

      if (!sourceForm.position.trim()) {
        return 'Position is required for player accounts.';
      }

      if (!sourceForm.age.trim()) {
        return 'Age is required for player accounts.';
      }

      if (!/^\d+$/.test(sourceForm.age.trim())) {
        return 'Age must be a whole number.';
      }
    }

    if (selectedRole === 'coach') {
      if (!sourceForm.fullName.trim()) {
        return 'Full name is required for coach accounts.';
      }

      if (!sourceForm.team.trim()) {
        return 'Team is required for coach accounts.';
      }
    }

    return '';
  };

  const rejectWrongRoleAccess = async (accountRole: Role) => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthBusy(false);
    setProfileBusy(false);
    setAuthError(`This email is registered as a ${accountRole}. Use the ${accountRole} login.`);
    setPhase('auth');
    Alert.alert('Wrong account type', `This email is registered as a ${accountRole}. Use the ${accountRole} login.`);
  };

  const handlePasswordReset = async () => {
    if (!form.password.trim()) {
      setAuthError('Enter a new password.');
      Alert.alert('Missing password', 'Enter a new password.');
      return;
    }

    if (form.password.trim().length < 6) {
      setAuthError('Password must be at least 6 characters.');
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }

    setAuthError('');
    setAuthBusy(true);

    const { error } = await supabase.auth.updateUser({
      password: form.password,
    });

    if (error) {
      setAuthBusy(false);
      setAuthError(error.message);
      Alert.alert('Reset failed', error.message);
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setIsPasswordRecovery(false);
    setAuthBusy(false);
    setAuthMode('login');
    setForm((current) => ({ ...current, password: '' }));
    setAuthError('Password updated. Log in with your new password.');
    Alert.alert('Password updated', 'Your password has been updated. Log in with your new password.');
  };

  const handleOpenPrivacyPolicy = async () => {
    await Linking.openURL(PRIVACY_POLICY_URL);
  };

  const handleOpenTermsOfService = async () => {
    await Linking.openURL(TERMS_OF_SERVICE_URL);
  };

  const handleForgotPassword = async () => {
    const email = form.email.trim();

    if (!email) {
      setAuthError('Enter your email first.');
      Alert.alert('Missing email', 'Enter your email first so we can send the reset link.');
      return;
    }

    if (!emailPattern.test(email)) {
      setAuthError('Enter a valid email address.');
      Alert.alert('Invalid email', 'Enter a valid email address first.');
      return;
    }

    setAuthError('');
    setAuthBusy(true);

    const redirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? appRedirectUrl || window.location.origin
        : 'globalsportsid://reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setAuthBusy(false);

    if (error) {
      setAuthError(error.message);
      Alert.alert('Reset email failed', error.message);
      return;
    }

    setAuthError(`Password reset email sent to ${email}.`);
    Alert.alert('Reset email sent', `We sent a password reset link to ${email}.`);
  };

  const handleAuth = async () => {
    if (isPasswordRecovery) {
      await handlePasswordReset();
      return;
    }

    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured. Check .env and restart Expo.');
      Alert.alert('Supabase not configured', 'Your .env file must contain the project URL and publishable key.');
      return;
    }

    const authValidationError =
      authMode === 'register'
        ? validateProfileRequirements(role, form, true)
        : !form.email.trim() || !form.password.trim()
          ? 'Email and password are required.'
          : !emailPattern.test(form.email.trim())
            ? 'Enter a valid email address.'
            : '';

    if (authValidationError) {
      setAuthError(authValidationError);
      Alert.alert('Missing details', authValidationError);
      return;
    }

    setAuthError('');
    setAuthBusy(true);

    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          const { data: roleLookup, error: roleLookupError } = await supabase.rpc('lookup_role_by_email', {
            target_email: form.email.trim(),
          });

          if (!roleLookupError && roleLookup && roleLookup !== role) {
            setAuthBusy(false);
            setAuthError(`This email is registered as a ${roleLookup}. Use the ${roleLookup} login.`);
            Alert.alert(
              'Wrong account type',
              `This email is registered as a ${roleLookup}. Use the ${roleLookup} login.`,
            );
            return;
          }
        }

        setAuthBusy(false);
        console.error('login error', error);
        setAuthError(error.message);
        Alert.alert('Login failed', error.message);
        return;
      }

      if (!data.user) {
        setAuthBusy(false);
        setAuthError('Supabase did not return a user for this login.');
        Alert.alert('Login failed', 'Supabase did not return a user for this login.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle<ProfileRow>();

      if (profileError) {
        setAuthBusy(false);
        console.error('login profile lookup error', profileError);
        setAuthError(profileError.message);
        Alert.alert('Login failed', profileError.message);
        return;
      }

      if (!profile) {
        const metadata = (data.user.user_metadata || {}) as Record<string, unknown>;
        const metadataRole = metadata.role as Role | undefined;
        const metadataSport = metadata.sport as Sport | undefined;

        if (metadataRole && metadataRole !== role) {
          await supabase.auth.signOut();
          setSession(null);
          setAuthBusy(false);
          setAuthError(`This email is registered as a ${metadataRole}. Use the ${metadataRole} login.`);
          Alert.alert('Wrong account type', `This email is registered as a ${metadataRole}. Use the ${metadataRole} login.`);
          return;
        }

        const { profile: restoredProfile, error: restoreError } = await ensureProfileRecord(
          data.user,
          metadataRole ?? role,
          metadataSport ?? sport,
        );

        if (restoreError || !restoredProfile) {
          await supabase.auth.signOut();
          setSession(null);
          setAuthBusy(false);
          setAuthError(restoreError?.message || 'We could not restore your profile. Please try again.');
          Alert.alert('Login failed', restoreError?.message || 'We could not restore your profile. Please try again.');
          return;
        }

        hydrateFromProfile(restoredProfile);
        setAuthBusy(false);
        completeAppEntry();
        return;
      }

      if (profile.role !== role) {
        await supabase.auth.signOut();
        setSession(null);
        setAuthBusy(false);
        const expectedRole = profile.role === 'coach' ? 'coach' : 'player';
        setAuthError(`This email is registered as a ${expectedRole}. Use the ${expectedRole} login.`);
        Alert.alert('Wrong account type', `This email is registered as a ${expectedRole}. Use the ${expectedRole} login.`);
        return;
      }

      hydrateFromProfile(profile);
      setAuthBusy(false);
      completeAppEntry();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          full_name: form.fullName.trim(),
          role,
          sport,
          team_name: form.team.trim() || null,
          gender: role === 'player' ? form.gender.trim() || null : null,
          nationality: form.nationality.trim() || null,
          age: form.age.trim() || null,
          city: form.city.trim() || null,
          country: form.country.trim() || null,
          position: form.position.trim() || null,
          bio: form.bio.trim() || null,
          highlights_url: role === 'player' ? form.highlights.trim() || null : null,
        },
      },
    });

    if (error) {
      const duplicateSignup =
        /already registered|already exists|user already/i.test(error.message) ||
        error.status === 422;
      const duplicateMessage = 'Email already registered';
      setAuthBusy(false);
      console.error('signup error', error);
      setAuthError(duplicateSignup ? duplicateMessage : error.message);
      Alert.alert('Registration failed', duplicateSignup ? duplicateMessage : error.message);
      return;
    }

    if (!data.user) {
      setAuthBusy(false);
      setAuthError('Supabase did not return a user.');
      Alert.alert('Registration incomplete', 'Supabase did not return a user.');
      return;
    }

    if (data.session) {
      setSession(data.session);
      const { profile: createdProfile, error: createdProfileError } = await ensureProfileRecord(data.user, role, sport, form);
      setAuthBusy(false);

      if (createdProfileError || !createdProfile) {
        setAuthError(createdProfileError?.message || 'We could not finish creating your profile.');
        Alert.alert('Registration failed', createdProfileError?.message || 'We could not finish creating your profile.');
        return;
      }

      hydrateFromProfile(createdProfile);
      completeAppEntry();
      return;
    }

    const duplicateSignupAttempt =
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0;

    setAuthBusy(false);

    if (duplicateSignupAttempt) {
      setAuthError('Email already registered');
      Alert.alert('Registration failed', 'Email already registered');
      return;
    }

    setAuthError('Check your email to confirm your account, then log in.');
    Alert.alert(
      'Check your email',
      'We sent you a confirmation email. Confirm your account first, then come back and log in.',
    );
    setAuthMode('login');
    return;
  };

  const handleEnterApp = async () => {
    if (session?.user) {
      const saved = await persistProfile(sport);
      if (!saved) {
        return;
      }
    }

    completeAppEntry();
  };

  const handleSaveProfile = async () => {
    const profileValidationError = validateProfileRequirements(role, { ...form, password: form.password || 'saved-password' });

    if (profileValidationError) {
      Alert.alert('Missing details', profileValidationError);
      return;
    }

    const saved = await persistProfile(sport);
    if (saved) {
      setIsEditingProfile(false);
      Alert.alert('Saved', 'Your profile was updated in Supabase.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setForm(emptyForm);
    setTab('explore');
    setExploreMode('players');
    setSelectedCoachId(null);
    setSelectedTrialId(null);
    setSelectedOfferId(null);
    setSelectedConversationId(null);
    setShowRequests(false);
    setIsEditingProfile(false);
    setPhase('welcome');
    setAuthMode('register');
  };

  const selectedPlayer = filteredPlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const selectedCoach = filteredCoaches.find((coach) => coach.id === selectedCoachId) ?? null;
  const selectedTrial = filteredTrials.find((trial) => trial.id === selectedTrialId) ?? null;
  const selectedOffer = filteredOffers.find((offer) => offer.id === selectedOfferId) ?? null;
  const selectedConversation = filteredConversations.find((item) => item.id === selectedConversationId) ?? null;
  const unreadConversationCount = useMemo(
    () => filteredConversations.reduce((count, thread) => count + (thread.unreadCount && thread.unreadCount > 0 ? 1 : 0), 0),
    [filteredConversations],
  );
  const ownCoachTrials = useMemo(
    () => trialListings.filter((trial) => trial.coachName === (form.fullName || 'COACH').toUpperCase() && trial.sport === sport),
    [form.fullName, sport, trialListings],
  );
  const ownCoachOffers = useMemo(
    () => offerListings.filter((offer) => offer.coachName === (form.fullName || 'COACH').toUpperCase() && offer.sport === sport),
    [form.fullName, offerListings, sport],
  );

  const handleOpenConversation = (conversationId: string) => {
    setShowRequests(false);
    setSelectedConversationId(conversationId);
    void markConversationAsRead(conversationId);
  };

  const markConversationAsRead = async (conversationId: string) => {
    const thread = conversationThreads.find((item) => item.id === conversationId);

    if (!thread) {
      return;
    }

    setConversationThreads((current) =>
      current.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              unreadCount: 0,
              messages: item.messages.map((message) =>
                message.from === 'them'
                  ? {
                      ...message,
                      isRead: true,
                    }
                  : message,
              ),
            }
          : item,
      ),
    );

    if (!session?.user || !thread.conversationId || !isSupabaseConfigured) {
      return;
    }

    const incomingMessageIds = thread.messages.filter((message) => message.from === 'them' && message.id && !message.isRead).map((message) => message.id as string);

    if (!incomingMessageIds.length) {
      return;
    }

    const { error } = await supabase.from('messages').update({ is_read: true }).in('id', incomingMessageIds);

    if (error) {
      console.error('mark messages read error', error);
    }
  };

  const resetMessageView = () => {
    setTab('messages');
    setShowRequests(false);
  };

  const findExistingConversation = (otherProfileId?: string, name?: string, conversationSport: Sport = sport) =>
    conversationThreads.find(
      (thread) =>
        (otherProfileId && thread.otherProfileId === otherProfileId) ||
        (!!name && thread.name === name && thread.sport === conversationSport),
    );

  const removeDuplicateThreads = (
    threads: ConversationThread[],
    match: { id?: string; conversationId?: string; otherProfileId?: string; name?: string; sport?: Sport },
  ) =>
    threads.filter((thread) => {
      if (match.id && thread.id === match.id) {
        return false;
      }

      if (match.conversationId && thread.conversationId === match.conversationId) {
        return false;
      }

      if (match.otherProfileId && thread.otherProfileId === match.otherProfileId) {
        return false;
      }

      if (match.name && match.sport && thread.name === match.name && thread.sport === match.sport) {
        return false;
      }

      return true;
    });

  const openConversationThread = (thread: ConversationThread) => {
    setConversationThreads((current) => [
      thread,
      ...removeDuplicateThreads(current, {
        id: thread.id,
        conversationId: thread.conversationId,
        otherProfileId: thread.otherProfileId,
        name: thread.name,
        sport: thread.sport,
      }),
    ]);
    resetMessageView();
    setSelectedConversationId(thread.id);
    setDraftMessage('');
  };

  const getOrCreateDirectConversationId = async (otherProfileId: string): Promise<string | null> => {
    if (!session?.user || !isSupabaseConfigured) {
      return null;
    }

    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
      other_profile_id: otherProfileId,
    });

    if (error) {
      Alert.alert('Conversation setup failed', error.message);
      return null;
    }

    return typeof data === 'string' ? data : null;
  };

  const loadConversationMessages = async (conversationId: string): Promise<MessageEntry[] | null> => {
    if (!session?.user || !isSupabaseConfigured) {
      return [];
    }

    const { data: messageRows, error: messageError } = await supabase
      .from('messages')
      .select('id, sender_id, body, is_read')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messageError) {
      Alert.alert('Conversation lookup failed', messageError.message);
      return null;
    }

    return (messageRows ?? []).map((row) => ({
      id: row.id,
      from: row.sender_id === session.user.id ? 'me' as const : 'them' as const,
      body: row.body,
      isRead: row.sender_id === session.user.id ? true : !!row.is_read,
    }));
  };

  const ensureDirectConversationThread = async (
    otherProfile: DirectConversationTarget,
    emptyPreview = 'Start your conversation',
  ): Promise<ConversationThread | null> => {
    if (otherProfile.role && otherProfile.role === role) {
      Alert.alert('Messaging not allowed', `A ${role} account cannot message another ${role} account.`);
      return null;
    }

    const existingConversation = findExistingConversation(otherProfile.profileId, otherProfile.name, otherProfile.sport);
    if (existingConversation?.conversationId) {
      return existingConversation;
    }

    if (!session?.user || !otherProfile.profileId || !isSupabaseConfigured) {
      const fallbackConversationId = existingConversation?.id ?? `${otherProfile.name.toLowerCase().replace(/\s+/g, '-')}-chat`;

      return {
        id: fallbackConversationId,
        otherProfileId: otherProfile.profileId,
        otherRole: otherProfile.role,
        name: otherProfile.name,
        preview: existingConversation?.preview || emptyPreview,
        sport: otherProfile.sport,
        avatar: otherProfile.avatar,
        team: otherProfile.team,
        position: otherProfile.position,
        age: otherProfile.age,
        messages: existingConversation?.messages ?? [],
        unreadCount: existingConversation?.unreadCount ?? 0,
        pendingApproval: false,
      };
    }

    const otherProfileId = otherProfile.profileId;
    const durableConversationId = await getOrCreateDirectConversationId(otherProfileId);
    if (!durableConversationId) {
      Alert.alert('Conversation setup failed', 'Unable to determine the conversation to open.');
      return null;
    }

    const messages = await loadConversationMessages(durableConversationId);
    if (messages === null) {
      return null;
    }

    const preview = messages.at(-1)?.body || emptyPreview;
    const unreadCount = messages.filter((message) => message.from === 'them' && !message.isRead).length;

    return {
      id: durableConversationId,
      conversationId: durableConversationId,
      otherProfileId,
      otherRole: otherProfile.role,
      name: otherProfile.name,
      preview,
      sport: otherProfile.sport,
      avatar: otherProfile.avatar,
      team: otherProfile.team,
      position: otherProfile.position,
      age: otherProfile.age,
      messages,
      unreadCount,
      pendingApproval: false,
    };
  };

  const openDirectConversation = async (otherProfile: DirectConversationTarget, openingMessage: string) => {
    const thread = await ensureDirectConversationThread(otherProfile, openingMessage);
    if (!thread) {
      return;
    }

    openConversationThread(thread);
    setMessagingRefreshKey((current) => current + 1);
  };

  const openCoachConversation = async (coach: CoachCard) => {
    await openDirectConversation(
      {
        profileId: coach.profileId,
        name: coach.name,
        role: 'coach',
        sport: coach.sport,
        avatar: coach.avatar,
        team: coach.team,
      },
      'Start your conversation',
    );
  };

  const handleMessageProfile = (name: string, openingMessage: string, conversationSport: Sport = sport) => {
    openConversationThread({
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-chat`,
      name,
      preview: openingMessage,
      sport: conversationSport,
      messages: [],
      unreadCount: 0,
    });
  };

  const handleCoachRequestContact = async (coach: CoachCard) => {
    if (coach.profileId && coach.profileId === session?.user?.id) {
      Alert.alert('Your profile', 'You cannot message your own coach profile.');
      return;
    }

    if (role !== 'player') {
      Alert.alert('Players only', 'This contact action is only available from player accounts.');
      return;
    }

    await openCoachConversation(coach);
  };

  const handlePlayerContact = async (player: PlayerCard) => {
    if (player.profileId && player.profileId === session?.user?.id) {
      Alert.alert('Your profile', 'You cannot message your own player profile.');
      return;
    }

    if (role === 'coach') {
      setSelectedPlayerId(null);
      await openDirectConversation(
        {
          profileId: player.profileId,
          name: player.name,
          role: 'player',
          sport: player.sport,
          avatar: player.avatar,
          team: player.team,
          position: player.position,
          age: player.age,
        },
        `Hello ${player.name}, I would like to talk about an opportunity.`,
      );
      return;
    }

    Alert.alert('Messaging not allowed', 'Players can only request contact with coaches.');
  };

  const handleOfferCoachContact = async (offer: OfferCard) => {
    let coach = coachProfiles.find(
      (item) => item.profileId === offer.coachProfileId || (item.name === offer.coachName && item.sport === offer.sport),
    );

    if (!coach && offer.coachProfileId && isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, team_name, city, country, bio, avatar_url, sport')
        .eq('id', offer.coachProfileId)
        .eq('role', 'coach')
        .single();

      if (error) {
        Alert.alert('Coach lookup failed', error.message);
        return;
      }

      if (data) {
        coach = {
          id: data.id,
          profileId: data.id,
          sport: (data.sport as Sport) || offer.sport,
          name: (data.full_name || 'COACH').toUpperCase(),
          team: data.team_name || 'TEAM',
          location: [data.city, data.country].filter(Boolean).join(', ').toUpperCase() || 'LOCATION',
          bio: data.bio || 'Coach profile coming soon.',
          avatar: data.avatar_url || undefined,
          trials: [],
          offers: [],
        };
      }
    }

    if (!coach) {
      Alert.alert('Coach not available yet', `${offer.coachName} is not connected to the live database yet.`);
      return;
    }

    await openCoachConversation(coach);
  };

  const handleOpenConversationProfile = (conversation: ConversationThread) => {
    if (!conversation.otherProfileId || !conversation.otherRole) {
      return;
    }

    setTab('explore');
    setSelectedConversationId(null);
    setShowRequests(false);
    setSelectedTrialId(null);
    setSelectedOfferId(null);

    if (conversation.otherRole === 'coach') {
      setExploreMode('coaches');
      setSelectedPlayerId(null);
      setSelectedCoachId(conversation.otherProfileId);
      return;
    }

    setExploreMode('players');
    setSelectedCoachId(null);
    setSelectedPlayerId(conversation.otherProfileId);
  };

  const handleHighlightsPress = async (highlightsUrl?: string) => {
    if (!highlightsUrl) {
      Alert.alert('No highlights yet', 'This player has not uploaded a highlights link yet.');
      return;
    }

    const supported = await Linking.canOpenURL(highlightsUrl);

    if (!supported) {
      Alert.alert('Link unavailable', 'This highlights link could not be opened.');
      return;
    }

    await Linking.openURL(highlightsUrl);
  };

  const handlePickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access so you can choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    const asset = result.assets[0];
    const nextAvatar = asset.base64
      ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
      : asset.uri;

    setForm((current) => ({ ...current, avatar: nextAvatar }));
  };

  const handleFilterFindPlayers = () => {
    setActivePlayerFilters(playerFilterDraft);
    setShowCoachFilters(false);
  };

  const handleClearFilters = () => {
    setPlayerFilterDraft(emptyPlayerFilters);
    setActivePlayerFilters(emptyPlayerFilters);
    setShowCoachFilters(false);
  };

  const handlePublishDraft = async (title: string) => {
    if (role !== 'coach') {
      Alert.alert('Coaches only', 'Only coach accounts can publish trials and offers.');
      return;
    }

    if (title === 'Trial') {
      if (!trialDraft.team.trim() || !trialDraft.location.trim() || !trialDraft.time.trim() || !trialDraft.details.trim()) {
        Alert.alert('Missing details', 'Fill in team, location, time, and details before publishing.');
        return;
      }

      if (
        !trialPostLocationFilter.selected ||
        normalizeLocationValue(trialDraft.location) !== normalizeLocationValue(trialPostLocationFilter.selected)
      ) {
        Alert.alert('Select location', 'Choose an exact location from the suggestions before publishing the trial.');
        return;
      }

      const nextTrial: TrialCard = {
        id: `trial-${Date.now()}`,
        sport,
        coachName: (form.fullName || 'COACH').toUpperCase(),
        team: trialDraft.team.trim().toUpperCase(),
        time: trialDraft.time.trim(),
        location: trialDraft.location.trim(),
        description: trialDraft.details.trim(),
        registrationLink: trialDraft.registrationLink.trim(),
      };

      let nextTrialId = nextTrial.id;

      if (session?.user && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('trials')
          .insert({
            coach_id: session.user.id,
            sport,
            team_name: trialDraft.team.trim(),
            location_text: trialDraft.location.trim(),
            event_time: trialDraft.time.trim(),
            description: trialDraft.details.trim(),
            registration_link: trialDraft.registrationLink.trim() || null,
          })
          .select('id')
          .single();

        if (error) {
          Alert.alert('Publish failed', error.message);
          return;
        }

        nextTrialId = data.id;
      }

      setTrialListings((current) => [{ ...nextTrial, id: nextTrialId }, ...current]);
      setTrialDraft(emptyTrialDraft);
      setTrialPostLocationFilter(emptyListingLocationFilter);
      setExploreMode('trials');
      Alert.alert('Published', 'Your trial is now live.');
      return;
    }

    if (!offerDraft.team.trim() || !offerDraft.position.trim() || !offerDraft.ageRange.trim() || !offerDraft.details.trim()) {
      Alert.alert('Missing details', 'Fill in team, position, age range, and offer details before publishing.');
      return;
    }

    const nextOffer: OfferCard = {
      id: `offer-${Date.now()}`,
      sport,
      coachName: (form.fullName || 'COACH').toUpperCase(),
      team: offerDraft.team.trim().toUpperCase(),
      title: 'COACH OFFER',
      details: offerDraft.details.trim(),
      target: `${offerDraft.position.trim().toUpperCase()} | ${offerDraft.ageRange.trim().toUpperCase()}`,
      location: [form.city, form.country].filter(Boolean).join(', ').toUpperCase() || 'LOCATION',
    };

    let nextOfferId = nextOffer.id;

    if (session?.user && isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('offers')
        .insert({
          coach_id: session.user.id,
          sport,
          team_name: offerDraft.team.trim(),
          details: formatOfferDetailsPayload(offerDraft.position, offerDraft.ageRange, offerDraft.details),
        })
        .select('id')
        .single();

      if (error) {
        Alert.alert('Publish failed', error.message);
        return;
      }

      nextOfferId = data.id;
    }

    setOfferListings((current) => [{ ...nextOffer, id: nextOfferId }, ...current]);
    setOfferDraft(emptyOfferDraft);
    setExploreMode('offers');
    Alert.alert('Published', 'Your offer is now live.');
  };

  const handleDeleteDraft = (title: string) => {
    if (title === 'Trial') {
      setTrialDraft(emptyTrialDraft);
      setTrialPostLocationFilter(emptyListingLocationFilter);
    }

    if (title === 'Offer') {
      setOfferDraft(emptyOfferDraft);
    }

    Alert.alert('Draft deleted', `${title} draft was removed.`);
  };

  const confirmDeleteTrial = (trialId: string) => {
    const runDelete = async () => {
      const previous = trialListings;
      setTrialListings((current) => current.filter((trial) => trial.id !== trialId));

      if (isSupabaseConfigured && session?.user) {
        const { error } = await supabase.from('trials').delete().eq('id', trialId).eq('coach_id', session.user.id);

        if (error) {
          setTrialListings(previous);
          Alert.alert('Delete failed', error.message);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this trial?')) {
        void runDelete();
      }
      return;
    }

    Alert.alert('Delete trial', 'Are you sure you want to delete this trial?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => void runDelete(),
      },
    ]);
  };

  const confirmDeleteOffer = (offerId: string) => {
    const runDelete = async () => {
      const previous = offerListings;
      setOfferListings((current) => current.filter((offer) => offer.id !== offerId));

      if (isSupabaseConfigured && session?.user) {
        const { error } = await supabase.from('offers').delete().eq('id', offerId).eq('coach_id', session.user.id);

        if (error) {
          setOfferListings(previous);
          Alert.alert('Delete failed', error.message);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this offer?')) {
        void runDelete();
      }
      return;
    }

    Alert.alert('Delete offer', 'Are you sure you want to delete this offer?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => void runDelete(),
      },
    ]);
  };

  const handleSendMessage = () => {
    const nextMessage = draftMessage.trim();

    if (!selectedConversationId || !nextMessage) {
      return;
    }

    const currentThread = conversationThreads.find((thread) => thread.id === selectedConversationId);

    if (currentThread?.pendingApproval) {
      Alert.alert('Request pending', 'You will be able to continue messaging once the request is accepted.');
      return;
    }

    setConversationThreads((current) =>
      current.map((thread) =>
        thread.id === selectedConversationId
          ? {
              ...thread,
              preview: nextMessage,
              messages: [...thread.messages, { from: 'me', body: nextMessage, isRead: true }],
            }
          : thread,
      ),
    );
    setDraftMessage('');

    if (!session?.user || !currentThread?.conversationId) {
      return;
    }

    supabase
      .from('messages')
      .insert({
        conversation_id: currentThread.conversationId,
        sender_id: session.user.id,
        body: nextMessage,
      })
      .then(({ error }) => {
        if (error) {
          console.error('send message error', error);
          Alert.alert('Message not saved', error.message);
        }
      });
  };

  const handleAcceptRequest = async (requestId: string) => {
    const request = requestThreads.find((item) => item.id === requestId);

    if (!request || requestActionBusyId) {
      return;
    }

    setRequestActionBusyId(requestId);
    try {
      const acceptedThread = await ensureDirectConversationThread(
        {
          profileId: request.senderId,
          name: request.name,
          role: request.otherRole,
          sport: request.sport,
          avatar: request.avatar,
          team: request.team,
          position: request.position,
          age: request.age,
        },
        request.text,
      );

      if (!acceptedThread) {
        return;
      }

      if (session?.user && isSupabaseConfigured) {
        const { error: requestError } = await supabase
          .from('contact_requests')
          .update({ status: 'accepted' })
          .eq('id', request.id);

        if (requestError) {
          Alert.alert('Request accept failed', requestError.message);
          return;
        }
      }

      setRequestThreads((current) => current.filter((item) => item.id !== requestId));
      setShowRequests(false);
      openConversationThread({
        ...acceptedThread,
        preview: acceptedThread.messages.length ? acceptedThread.preview : request.text,
      });
      setMessagingRefreshKey((current) => current + 1);
    } finally {
      setRequestActionBusyId(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (requestActionBusyId) {
      return;
    }

    setRequestActionBusyId(requestId);
    const nextRequests = requestThreads.filter((item) => item.id !== requestId);
    setRequestThreads(nextRequests);

    if (nextRequests.length === 0) {
      setShowRequests(false);
    }

    try {
      if (session?.user && isSupabaseConfigured) {
        const { error } = await supabase.from('contact_requests').delete().eq('id', requestId);

        if (error) {
          setRequestThreads(requestThreads);
          Alert.alert('Delete failed', error.message);
          return;
        }

        setMessagingRefreshKey((current) => current + 1);
      }
    } finally {
      setRequestActionBusyId(null);
    }
  };

  if (!fontsLoaded || loadingSession) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safe, styles.center]}>
          <ActivityIndicator color={colors.gold} size="large" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} {...swipeBackResponder.panHandlers}>
        <StatusBar style="light" />
        {phase === 'welcome' ? (
        <ScrollView contentContainerStyle={styles.wrap}>
            <Image resizeMode="contain" source={require('./assets/global-sports-logo-app.png')} style={styles.logo} />
            {glossyGoldButton('Log In / Register As A Player', () => {
              setRole('player');
              setAuthMode('login');
              setPhase('auth');
            }, styles.heroBtn, styles.heroBtnText)}
            {glossyGoldButton('Log In / Register As A Coach', () => {
              setRole('coach');
              setAuthMode('login');
              setPhase('auth');
            }, styles.heroBtn, styles.heroBtnText)}
          </ScrollView>
        ) : null}

        {phase === 'auth' ? (
          <ScrollView contentContainerStyle={styles.wrap}>
            <Pressable
              style={styles.inlineBack}
              onPress={() => {
                setAuthError('');
                setPhase('welcome');
              }}
            >
              <Text style={styles.inlineBackText}>Back To Home</Text>
            </Pressable>
            <Text style={styles.title}>
              {isPasswordRecovery
                ? 'Reset Password'
                : role === 'coach'
                ? authMode === 'register'
                  ? 'Coach Registration Form'
                  : 'Coach Login'
                : authMode === 'register'
                  ? 'Player Registration Form'
                  : 'Player Login'}
            </Text>
            {isPasswordRecovery ? (
              <>
                <Text style={styles.cardText}>Enter your new password below.</Text>
                {input('NEW PASSWORD', form.password, (v) => setForm({ ...form, password: v }), true)}
              </>
            ) : (
              <>
                {authMode === 'register' ? input('FULL NAME', form.fullName, (v) => setForm({ ...form, fullName: v })) : null}
                {input('EMAIL', form.email, (v) => setForm({ ...form, email: v }))}
                {input('PASSWORD', form.password, (v) => setForm({ ...form, password: v }), true)}
                {authMode === 'register' ? (
                  <>
                    {input('UNIVERSITY / TEAM', form.team, (v) => setForm({ ...form, team: v }))}
                    <Text style={styles.section}>SPORT OF INTEREST</Text>
                    <View style={styles.pills}>
                      {sports.map((item) => (
                        <Pressable
                          key={item}
                          style={[styles.pill, sport === item ? styles.pillActive : null]}
                          onPress={() => setSport(item)}
                        >
                          <Text style={[styles.pillText, sport === item ? styles.pillTextActive : null]}>{item.toUpperCase()}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {role === 'player' ? (
                      <>
                        <Text style={styles.section}>GENDER</Text>
                        <View style={styles.pills}>
                          {['female', 'male'].map((gender) => (
                            <Pressable
                              key={gender}
                              style={[styles.pill, form.gender === gender ? styles.pillActive : null]}
                              onPress={() => setForm({ ...form, gender })}
                            >
                              <Text style={[styles.pillText, form.gender === gender ? styles.pillTextActive : null]}>{gender.toUpperCase()}</Text>
                            </Pressable>
                          ))}
                        </View>
                        {inputWithSuggestions(
                          'NATIONALITY',
                          form.nationality,
                          (v) => setForm({ ...form, nationality: v }),
                          nationalitySuggestions,
                        )}
                        {input('AGE', form.age, (v) => setForm({ ...form, age: v }))}
                        <Text style={styles.section}>POSITION</Text>
                        <View style={styles.pills}>
                          {positions[sport].map((item) => (
                            <Pressable
                              key={item}
                              style={[styles.pill, form.position === item ? styles.pillActive : null]}
                              onPress={() => setForm({ ...form, position: item })}
                            >
                              <Text style={[styles.pillText, form.position === item ? styles.pillTextActive : null]}>{item}</Text>
                            </Pressable>
                          ))}
                        </View>
                        {inputWithSuggestions('CITY', form.city, (v) => setForm({ ...form, city: v }), citySuggestions)}
                        {inputWithSuggestions('COUNTRY', form.country, (v) => setForm({ ...form, country: v }), countrySuggestions)}
                        {input('HIGHLIGHTS LINK', form.highlights, (v) => setForm({ ...form, highlights: v }))}
                      </>
                    ) : (
                      <>
                        {inputWithSuggestions('CITY', form.city, (v) => setForm({ ...form, city: v }), citySuggestions)}
                        {inputWithSuggestions('COUNTRY', form.country, (v) => setForm({ ...form, country: v }), countrySuggestions)}
                      </>
                    )}
                  </>
                ) : null}
              </>
            )}
            <Pressable style={styles.darkBtn} onPress={handleAuth} disabled={authBusy}>
              <Text style={styles.darkBtnText}>
                {authBusy ? 'PLEASE WAIT' : isPasswordRecovery ? 'Save New Password' : authMode === 'register' ? 'Create An Account' : 'Log In'}
              </Text>
            </Pressable>
            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
            {!isPasswordRecovery && authMode === 'login' ? (
              <Pressable onPress={() => void handleForgotPassword()}>
                <Text style={styles.altLink}>Forgot Password?</Text>
              </Pressable>
            ) : null}
            {!isPasswordRecovery ? (
              <Pressable onPress={() => setAuthMode((current) => (current === 'register' ? 'login' : 'register'))}>
                <Text style={styles.altLink}>
                  {authMode === 'register' ? 'Already registered? Log in' : "Don't have an account? Register here"}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        {phase === 'app' ? (
          <View style={styles.safe}>
            <ScrollView contentContainerStyle={styles.appWrap}>
              <Text style={styles.title}>
                {tab === 'messages' ? 'Messages' : tab === 'profile' ? `${role === 'coach' ? 'Coach' : 'Player'} Profile` : 'Explore'}
              </Text>

              {tab === 'explore' ? (
                <>
                  <View style={role === 'coach' ? styles.modePillsCompact : styles.modePillsTight}>
                    {modeOptions.map(([key, label]) => (
                      <Pressable
                        key={key}
                        style={[
                          styles.pill,
                          role === 'coach' ? styles.modePillCompact : styles.modePillTight,
                          exploreMode === key ? styles.darkPill : null,
                        ]}
                        onPress={() => setExploreMode(key as ExploreMode)}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            role === 'coach' ? styles.modePillTextCompact : styles.modePillTextTight,
                            exploreMode === key ? styles.darkPillText : null,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {exploreMode === 'players'
                    ? role === 'coach'
                      ? selectedPlayer
                        ? playerDetailCard(
                            selectedPlayer,
                            () => setSelectedPlayerId(null),
                            () => handleHighlightsPress(selectedPlayer.highlights),
                            () => handlePlayerContact(selectedPlayer),
                            'Contact',
                          )
                        : (
                          <>
                            <View style={styles.actionRowSplit}>
                              <Pressable
                                style={styles.lightAction}
                                onPress={() => setShowCoachFilters((current) => !current)}
                              >
                                <Text style={styles.lightActionText}>{showCoachFilters ? 'Hide Filters' : 'Filters'}</Text>
                              </Pressable>
                            </View>
                            {showCoachFilters ? (
                              <View style={styles.inlineFilterPanel}>
                                <Text style={styles.section}>Coach Filters</Text>
                                <Text style={styles.inputLabel}>GENDER</Text>
                                <View style={styles.pills}>
                                  {['female', 'male'].map((gender) => (
                                    <Pressable
                                      key={gender}
                                      style={[styles.pill, playerFilterDraft.gender === gender ? styles.pillActive : null]}
                                      onPress={() =>
                                        setPlayerFilterDraft((current) => ({
                                          ...current,
                                          gender: current.gender === gender ? '' : gender,
                                        }))
                                      }
                                    >
                                      <Text style={[styles.pillText, playerFilterDraft.gender === gender ? styles.pillTextActive : null]}>
                                        {gender.toUpperCase()}
                                      </Text>
                                    </Pressable>
                                  ))}
                                </View>
                                <Text style={styles.inputLabel}>AGE</Text>
                                <View style={styles.row}>
                                  <View style={styles.flex}>{input('FROM', playerFilterDraft.ageFrom, (v) => setPlayerFilterDraft((current) => ({ ...current, ageFrom: v })))}</View>
                                  <View style={styles.flex}>{input('TO', playerFilterDraft.ageTo, (v) => setPlayerFilterDraft((current) => ({ ...current, ageTo: v })))}</View>
                                </View>
                                <Text style={styles.inputLabel}>POSITION</Text>
                                <View style={styles.compactPills}>
                                  {positions[sport].map((item) => (
                                    <Pressable
                                      key={item}
                                      style={[styles.pill, styles.compactPill, playerFilterDraft.position === item ? styles.pillActive : null]}
                                      onPress={() =>
                                        setPlayerFilterDraft((current) => ({
                                          ...current,
                                          position: current.position === item ? '' : item,
                                        }))
                                      }
                                    >
                                      <Text style={[styles.pillText, styles.compactPillText, playerFilterDraft.position === item ? styles.pillTextActive : null]}>{item}</Text>
                                    </Pressable>
                                  ))}
                                </View>
                                <View style={styles.inputBox}>
                                  <Text style={styles.inputLabel}>LOCATION</Text>
                                  <TextInput
                                    value={playerFilterDraft.location}
                                    onChangeText={(value) => setPlayerFilterDraft((current) => ({ ...current, location: value }))}
                                    style={styles.input}
                                    placeholder="Start typing a city"
                                    placeholderTextColor={colors.muted}
                                  />
                                  <View style={styles.line} />
                                  {locationSuggestions.length ? (
                                    <View style={styles.suggestionList}>
                                      {locationSuggestions.map((city) => (
                                        <Pressable
                                          key={city}
                                          style={styles.suggestionItem}
                                          onPress={() =>
                                            setPlayerFilterDraft((current) => ({
                                              ...current,
                                              location: city,
                                            }))
                                          }
                                        >
                                          <Text style={styles.suggestionText}>{city}</Text>
                                        </Pressable>
                                      ))}
                                    </View>
                                  ) : null}
                                </View>
                                <View style={styles.row}>
                                  <Pressable style={styles.lightBtnSmall} onPress={handleClearFilters}>
                                    <Text style={styles.lightBtnText}>Clear Filters</Text>
                                  </Pressable>
                                  <Pressable style={styles.darkBtnSmall} onPress={handleFilterFindPlayers}>
                                    <Text style={styles.darkBtnText}>Find Players</Text>
                                  </Pressable>
                                </View>
                              </View>
                            ) : null}
                            <View style={styles.inlineFilterSpacer} />
                            {filteredPlayers.map((item) =>
                              playerListCard(
                                item,
                                () => setSelectedPlayerId(item.id),
                                () => handleHighlightsPress(item.highlights),
                                () => handlePlayerContact(item),
                                'Contact',
                                true,
                              ),
                            )}
                          </>
                        )
                      : selectedPlayer
                        ? playerDetailCard(
                            selectedPlayer,
                            () => setSelectedPlayerId(null),
                            () => handleHighlightsPress(selectedPlayer.highlights),
                            selectedPlayer.profileId !== session?.user?.id ? () => handlePlayerContact(selectedPlayer) : undefined,
                            'Message Player',
                          )
                        : filteredPlayers.map((item) =>
                            playerListCard(
                              item,
                              () => setSelectedPlayerId(item.id),
                              () => handleHighlightsPress(item.highlights),
                              item.profileId !== session?.user?.id ? () => handlePlayerContact(item) : undefined,
                              'Message Player',
                            ),
                          )
                    : null}
                  {exploreMode === 'coaches'
                    ? selectedCoach
                      ? coachDetailCard(
                          selectedCoach,
                          () => setSelectedCoachId(null),
                          () => handleCoachRequestContact(selectedCoach),
                        )
                      : filteredCoaches.length > 0
                        ? filteredCoaches.map((coach) =>
                            coachListCard(
                              coach,
                              () => setSelectedCoachId(coach.id),
                              () => handleCoachRequestContact(coach),
                            ),
                          )
                        : (
                          <View style={styles.box}>
                            <Text style={styles.cardText}>No coach profiles are available yet.</Text>
                          </View>
                        )
                    : null}
                  {exploreMode === 'trials'
                    ? selectedTrial
                      ? trialDetailCard(selectedTrial, () => setSelectedTrialId(null))
                      : (
                        <>
                          <View style={styles.box}>
                            <View style={styles.locationFilterHeader}>
                              <Text style={styles.section}>Trial Location</Text>
                              {trialLocationFilter.selected ? (
                                <Pressable onPress={() => setTrialLocationFilter(emptyListingLocationFilter)} style={styles.lightAction}>
                                  <Text style={styles.lightActionText}>Clear</Text>
                                </Pressable>
                              ) : null}
                            </View>
                            <TextInput
                              value={trialLocationFilter.query}
                              onChangeText={(value) =>
                                setTrialLocationFilter({
                                  query: value,
                                  selected: '',
                                })
                              }
                              style={styles.input}
                              placeholder="Type a location"
                              placeholderTextColor={colors.muted}
                            />
                            <View style={styles.line} />
                            <Text style={styles.filterHint}>
                              {trialLocationFilter.selected
                                ? `Showing trials in ${trialLocationFilter.selected}.`
                                : 'Start typing and select a location to filter trials.'}
                            </Text>
                            {trialLocationSuggestions.length ? (
                              <View style={styles.suggestionList}>
                                {trialLocationSuggestions.map((location) => (
                                  <Pressable
                                    key={location}
                                    style={styles.suggestionItem}
                                    onPress={() =>
                                      setTrialLocationFilter({
                                        query: location,
                                        selected: location,
                                      })
                                    }
                                  >
                                    <Text style={styles.suggestionText}>{location}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            ) : null}
                          </View>
                          {filteredTrials.length
                            ? filteredTrials.map((trial) => trialListCard(trial, () => setSelectedTrialId(trial.id)))
                            : (
                              <View style={styles.box}>
                                <Text style={styles.cardText}>No trials match that location yet.</Text>
                              </View>
                            )}
                        </>
                      )
                    : null}
                  {exploreMode === 'offers'
                    ? selectedOffer
                      ? offerDetailCard(
                          selectedOffer,
                          () => setSelectedOfferId(null),
                          () => handleOfferCoachContact(selectedOffer),
                          'Request Contact',
                        )
                      : (
                        <>
                          <View style={styles.box}>
                            <View style={styles.locationFilterHeader}>
                              <Text style={styles.section}>Offer Location</Text>
                              {offerLocationFilter.selected ? (
                                <Pressable onPress={() => setOfferLocationFilter(emptyListingLocationFilter)} style={styles.lightAction}>
                                  <Text style={styles.lightActionText}>Clear</Text>
                                </Pressable>
                              ) : null}
                            </View>
                            <TextInput
                              value={offerLocationFilter.query}
                              onChangeText={(value) =>
                                setOfferLocationFilter({
                                  query: value,
                                  selected: '',
                                })
                              }
                              style={styles.input}
                              placeholder="Type a location"
                              placeholderTextColor={colors.muted}
                            />
                            <View style={styles.line} />
                            <Text style={styles.filterHint}>
                              {offerLocationFilter.selected
                                ? `Showing offers in ${offerLocationFilter.selected}.`
                                : 'Start typing and select a location to filter offers.'}
                            </Text>
                            {offerLocationSuggestions.length ? (
                              <View style={styles.suggestionList}>
                                {offerLocationSuggestions.map((location) => (
                                  <Pressable
                                    key={location}
                                    style={styles.suggestionItem}
                                    onPress={() =>
                                      setOfferLocationFilter({
                                        query: location,
                                        selected: location,
                                      })
                                    }
                                  >
                                    <Text style={styles.suggestionText}>{location}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            ) : null}
                          </View>
                          {filteredOffers.length
                            ? filteredOffers.map((offer) =>
                                offerListCard(
                                  offer,
                                  () => setSelectedOfferId(offer.id),
                                  () => handleOfferCoachContact(offer),
                                  'Request Contact',
                                ),
                              )
                            : (
                              <View style={styles.box}>
                                <Text style={styles.cardText}>No offers match that location yet.</Text>
                              </View>
                            )}
                        </>
                      )
                    : null}
                  {exploreMode === 'postTrial'
                    ? (
                      <View style={styles.box}>
                        <Text style={styles.section}>POST A TRIAL</Text>
                        {input('TEAM', trialDraft.team, (value) => setTrialDraft((current) => ({ ...current, team: value })))}
                        <View style={styles.inputBox}>
                          <View style={styles.locationFilterHeader}>
                            <Text style={styles.inputLabel}>LOCATION</Text>
                            {trialPostLocationFilter.selected ? (
                              <Pressable
                                onPress={() => {
                                  setTrialPostLocationFilter(emptyListingLocationFilter);
                                  setTrialDraft((current) => ({ ...current, location: '' }));
                                }}
                                style={styles.lightAction}
                              >
                                <Text style={styles.lightActionText}>Clear</Text>
                              </Pressable>
                            ) : null}
                          </View>
                          <TextInput
                            value={trialPostLocationFilter.query}
                            onChangeText={(value) => {
                              setTrialPostLocationFilter({
                                query: value,
                                selected: '',
                              });
                              setTrialDraft((current) => ({ ...current, location: value }));
                            }}
                            style={styles.input}
                            placeholder="Type and choose an exact location"
                            placeholderTextColor={colors.muted}
                          />
                          <View style={styles.line} />
                          <Text style={styles.filterHint}>
                            {trialPostLocationFilter.selected
                              ? `Selected location: ${trialPostLocationFilter.selected}.`
                              : 'Coaches must choose an exact location from the suggestions below.'}
                          </Text>
                          {trialPostLocationSuggestions.length ? (
                            <View style={styles.suggestionList}>
                              {trialPostLocationSuggestions.map((location) => (
                                <Pressable
                                  key={location}
                                  style={styles.suggestionItem}
                                  onPress={() => {
                                    setTrialPostLocationFilter({
                                      query: location,
                                      selected: location,
                                    });
                                    setTrialDraft((current) => ({ ...current, location }));
                                  }}
                                >
                                  <Text style={styles.suggestionText}>{location}</Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>
                        {input('TIME', trialDraft.time, (value) => setTrialDraft((current) => ({ ...current, time: value })))}
                        {input('DETAILS', trialDraft.details, (value) => setTrialDraft((current) => ({ ...current, details: value })))}
                        {input('REGISTRATION LINK', trialDraft.registrationLink, (value) => setTrialDraft((current) => ({ ...current, registrationLink: value })))}
                        <View style={styles.row}>
                          <Pressable style={styles.darkBtnSmall} onPress={() => handlePublishDraft('Trial')}>
                            <Text style={styles.darkBtnText}>Publish</Text>
                          </Pressable>
                          <Pressable style={styles.lightBtnSmall} onPress={() => handleDeleteDraft('Trial')}>
                            <Text style={styles.lightBtnText}>Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                    )
                    : null}
                  {exploreMode === 'postOffer'
                    ? formCard(
                        'POST AN OFFER',
                        [
                          ['TEAM', offerDraft.team, (value) => setOfferDraft((current) => ({ ...current, team: value }))],
                          ['POSITION', offerDraft.position, (value) => setOfferDraft((current) => ({ ...current, position: value }))],
                          ['AGE RANGE', offerDraft.ageRange, (value) => setOfferDraft((current) => ({ ...current, ageRange: value }))],
                          ['OFFER DETAILS', offerDraft.details, (value) => setOfferDraft((current) => ({ ...current, details: value }))],
                        ],
                        () => handlePublishDraft('Offer'),
                        () => handleDeleteDraft('Offer'),
                      )
                    : null}
                </>
              ) : null}

              {tab === 'messages' ? (
                <>
                  <View style={[styles.row, styles.messagesToolbar]}>
                    <TextInput
                      value={conversationSearch}
                      onChangeText={setConversationSearch}
                      style={styles.searchBar}
                      placeholder="Search conversations"
                      placeholderTextColor={colors.muted}
                      selectionColor={colors.goldSoft}
                    />
                    <Pressable
                      style={styles.requestPill}
                      onPress={() => {
                        setShowRequests(true);
                        setSelectedConversationId(null);
                      }}
                    >
                      <Text style={styles.requestText}>REQUESTS ({filteredRequests.length})</Text>
                    </Pressable>
                  </View>
                  {showRequests
                    ? filteredRequests.length > 0
                      ? filteredRequests.map((item) =>
                          requestCard(
                            item,
                            () => setShowRequests(false),
                            () => handleAcceptRequest(item.id),
                            () => handleDeleteRequest(item.id),
                            requestActionBusyId === item.id,
                          ),
                        )
                      : (
                        <View style={styles.box}>
                          <Pressable onPress={() => setShowRequests(false)} style={styles.inlineBack}>
                            <Text style={styles.inlineBackText}>Back To Messages</Text>
                          </Pressable>
                          <Text style={styles.cardText}>No pending requests right now.</Text>
                        </View>
                      )
                    : selectedConversation
                      ? conversationDetailCard(
                          selectedConversation,
                          draftMessage,
                          setDraftMessage,
                          handleSendMessage,
                          () => handleOpenConversationProfile(selectedConversation),
                          () => {
                            setSelectedConversationId(null);
                            setDraftMessage('');
                          },
                        )
                      : filteredConversations.length > 0
                        ? filteredConversations.map((item) => conversationCard(item, () => handleOpenConversation(item.id)))
                        : (
                          <View style={styles.box}>
                            <Text style={styles.cardText}>
                              {conversationSearch.trim() ? 'No conversations match your search.' : 'No conversations yet.'}
                            </Text>
                          </View>
                        )}
                </>
              ) : null}

              {tab === 'messages' && false ? (
                <>
                  <View style={styles.row}>
                    <View style={styles.searchBar}>
                      <Text style={styles.searchText}>⌕</Text>
                    </View>
                    <View style={styles.requestPill}>
                      <Text style={styles.requestText}>REQUESTS (3)</Text>
                    </View>
                  </View>
                  {null}
                </>
              ) : null}

              {tab === 'profile' ? (
                role === 'player' ? (
                  isEditingProfile ? (
                    <View style={styles.box}>
                      {input('FULL NAME', form.fullName, (v) => setForm({ ...form, fullName: v }))}
                      <Pressable style={styles.profileImageButton} onPress={handlePickProfilePhoto}>
                        {form.avatar ? (
                          <Image source={{ uri: form.avatar }} style={styles.profileImageButtonPhoto} />
                        ) : (
                          <View style={styles.profileImageButtonAvatar}>
                            <Text style={styles.profileImageButtonAvatarText}>{form.fullName ? form.fullName.slice(0, 2).toUpperCase() : 'GS'}</Text>
                          </View>
                        )}
                        <View style={styles.profileImageButtonBadge}>
                          <Text style={styles.profileImageButtonBadgeText}>{form.avatar ? 'Change Photo' : 'Add Photo'}</Text>
                        </View>
                      </Pressable>
                      {input('AGE', form.age, (v) => setForm({ ...form, age: v }))}
                      <Text style={styles.section}>GENDER</Text>
                      <View style={styles.pills}>
                        {['female', 'male'].map((gender) => (
                          <Pressable
                            key={gender}
                            style={[styles.pill, form.gender === gender ? styles.pillActive : null]}
                            onPress={() => setForm({ ...form, gender })}
                          >
                            <Text style={[styles.pillText, form.gender === gender ? styles.pillTextActive : null]}>{gender.toUpperCase()}</Text>
                          </Pressable>
                        ))}
                      </View>
                      {inputWithSuggestions(
                        'NATIONALITY',
                        form.nationality,
                        (v) => setForm({ ...form, nationality: v }),
                        nationalitySuggestions,
                      )}
                      {input('UNIVERSITY / TEAM', form.team, (v) => setForm({ ...form, team: v }))}
                      <Text style={styles.section}>POSITION</Text>
                      <View style={styles.pills}>
                        {positions[sport].map((item) => (
                          <Pressable
                            key={item}
                            style={[styles.pill, form.position === item ? styles.pillActive : null]}
                            onPress={() => setForm({ ...form, position: item })}
                          >
                            <Text style={[styles.pillText, form.position === item ? styles.pillTextActive : null]}>{item}</Text>
                          </Pressable>
                        ))}
                      </View>
                      {inputWithSuggestions('CITY', form.city, (v) => setForm({ ...form, city: v }), citySuggestions)}
                      {inputWithSuggestions('COUNTRY', form.country, (v) => setForm({ ...form, country: v }), countrySuggestions)}
                      {input('STATS', form.stats, (v) => setForm({ ...form, stats: v }), false, statsFieldConfig[sport].placeholder)}
                      {input('HIGHLIGHTS LINK', form.highlights, (v) => setForm({ ...form, highlights: v }))}
                      <Text style={styles.section}>SPORT</Text>
                      <View style={styles.detailLineCard}>
                        <Text style={styles.cardText}>{sport.toUpperCase()}</Text>
                      </View>
                      <View style={styles.row}>
                        <Pressable style={styles.darkBtnSmall} onPress={handleSaveProfile} disabled={profileBusy}>
                          <Text style={styles.darkBtnText}>{profileBusy ? 'Saving' : 'Save Changes'}</Text>
                        </Pressable>
                        <Pressable style={styles.lightBtnSmall} onPress={() => setIsEditingProfile(false)}>
                          <Text style={styles.lightBtnText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    playerProfileCard(
                      {
                        fullName: form.fullName,
                        sport,
                        age: form.age,
                        gender: form.gender,
                        nationality: form.nationality,
                        team: form.team,
                        city: form.city,
                        country: form.country,
                        position: form.position,
                        avatar: form.avatar,
                        highlights: form.highlights,
                        stats: form.stats,
                      },
                      () => setIsEditingProfile(true),
                      handleLogout,
                      () => handleHighlightsPress(form.highlights),
                      handleOpenPrivacyPolicy,
                      handleOpenTermsOfService,
                    )
                  )
                ) : (
                  <View style={styles.flatPanel}>
                    {isEditingProfile ? (
                      <Pressable style={styles.profileImageButton} onPress={handlePickProfilePhoto}>
                        {form.avatar ? (
                          <Image source={{ uri: form.avatar }} style={styles.profileImageButtonPhoto} />
                        ) : (
                          <View style={styles.profileImageButtonAvatar}>
                            <Text style={styles.profileImageButtonAvatarText}>{form.fullName ? form.fullName.slice(0, 2).toUpperCase() : 'GS'}</Text>
                          </View>
                        )}
                        <View style={styles.profileImageButtonBadge}>
                          <Text style={styles.profileImageButtonBadgeText}>{form.avatar ? 'Change Photo' : 'Add Photo'}</Text>
                        </View>
                      </Pressable>
                    ) : form.avatar ? (
                      <Image source={{ uri: form.avatar }} style={styles.profilePhoto} />
                    ) : (
                      <View style={styles.profileCircle}>
                        <Text style={styles.profileCircleText}>{form.fullName ? form.fullName.slice(0, 2).toUpperCase() : 'GS'}</Text>
                      </View>
                    )}
                    <Text style={styles.profileName}>{form.fullName || 'GLOBAL SPORTS USER'}</Text>
                    <Text style={styles.profileMeta}>{sport.toUpperCase()} | {form.team || 'TEAM'}</Text>
                    <Text style={styles.profileMeta}>{[form.city, form.country].filter(Boolean).join(', ') || 'LOCATION'}</Text>
                      {isEditingProfile ? (
                        <>
                          {input('FULL NAME', form.fullName, (v) => setForm({ ...form, fullName: v }))}
                          {input('UNIVERSITY / TEAM', form.team, (v) => setForm({ ...form, team: v }))}
                          {inputWithSuggestions('COUNTRY', form.country, (v) => setForm({ ...form, country: v }), countrySuggestions)}
                          {input('BIOGRAPHY', form.bio, (v) => setForm({ ...form, bio: v }))}
                          <View style={styles.row}>
                            <Pressable style={styles.darkBtnSmall} onPress={handleSaveProfile} disabled={profileBusy}>
                              <Text style={styles.darkBtnText}>{profileBusy ? 'Saving' : 'Save Changes'}</Text>
                          </Pressable>
                          <Pressable style={styles.lightBtnSmall} onPress={() => setIsEditingProfile(false)}>
                            <Text style={styles.lightBtnText}>Cancel</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        {form.bio ? (
                          <>
                            <Text style={styles.section}>Biography</Text>
                            <View style={styles.detailLineCard}>
                              <Text style={styles.cardText}>{form.bio}</Text>
                            </View>
                          </>
                        ) : null}
                        <Text style={styles.section}>Published Trials</Text>
                        {ownCoachTrials.length ? (
                          ownCoachTrials.map((trial) => (
                            <View key={trial.id} style={styles.detailLineCard}>
                              <View style={styles.inlineItemHeader}>
                                <Text style={[styles.cardText, styles.inlineItemText]}>
                                  {trial.team} | {trial.time} | {trial.location}
                                </Text>
                                <Pressable style={styles.inlineDeleteButton} onPress={() => confirmDeleteTrial(trial.id)}>
                                  {deleteActionIcon()}
                                </Pressable>
                              </View>
                              <Text style={styles.cardText}>{trial.description}</Text>
                            </View>
                          ))
                        ) : (
                          <View style={styles.detailLineCard}>
                            <Text style={styles.cardText}>No trials published yet.</Text>
                          </View>
                        )}
                        <Text style={styles.section}>Published Offers</Text>
                        {ownCoachOffers.length ? (
                          ownCoachOffers.map((offer) => (
                            <View key={offer.id} style={styles.detailLineCard}>
                              <View style={styles.inlineItemHeader}>
                                <Text style={[styles.cardText, styles.inlineItemText]}>
                                  {offer.team} | {offer.location}
                                </Text>
                                <Pressable style={styles.inlineDeleteButton} onPress={() => confirmDeleteOffer(offer.id)}>
                                  {deleteActionIcon()}
                                </Pressable>
                              </View>
                              <Text style={styles.cardText}>{offer.details}</Text>
                            </View>
                          ))
                        ) : (
                          <View style={styles.detailLineCard}>
                            <Text style={styles.cardText}>No offers published yet.</Text>
                          </View>
                        )}
                        <View style={styles.row}>
                          <Pressable style={styles.darkBtnSmall} onPress={() => setIsEditingProfile(true)}>
                            <Text style={styles.darkBtnText}>Edit Profile</Text>
                          </Pressable>
                          <Pressable style={styles.lightBtnSmall} onPress={handleLogout}>
                            <Text style={styles.lightBtnText}>Log Out</Text>
                          </Pressable>
                        </View>
                        <View style={styles.profileLegalLinks}>
                          <Pressable onPress={handleOpenPrivacyPolicy}>
                            <Text style={styles.profileLegalLink}>Privacy Policy</Text>
                          </Pressable>
                          <Pressable onPress={handleOpenTermsOfService}>
                            <Text style={styles.profileLegalLink}>Terms of Service</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                )
              ) : null}
            </ScrollView>

            <View style={styles.bottom}>
              {[ 
                ['explore', '⌕', 'Explore'],
                ['messages', '◫', 'Messages'],
                ['profile', '◯', 'Profile'],
              ].map(([key, icon, label]) => (
                <Pressable key={key} style={styles.bottomItem} onPress={() => setTab(key as Tab)}>
                  {bottomNavIcon(key as Tab, tab === key, key === 'messages' ? unreadConversationCount : 0)}
                  <Text style={[styles.bottomLabel, tab === key ? styles.bottomLabelActive : null]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function input(
  label: string,
  value: string,
  setValue: (value: string) => void,
  secureTextEntry = false,
  placeholder = '',
) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={setValue}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
      <View style={styles.line} />
    </View>
  );
}

function inputWithSuggestions(
  label: string,
  value: string,
  setValue: (value: string) => void,
  suggestions: readonly string[],
  secureTextEntry = false,
  placeholder = '',
) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        secureTextEntry={secureTextEntry}
        value={value}
        onChangeText={setValue}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
      <View style={styles.line} />
      {suggestions.length ? (
        <View style={styles.suggestionList}>
          {suggestions.map((item) => (
            <Pressable key={`${label}-${item}`} style={styles.suggestionItem} onPress={() => setValue(item)}>
              <Text style={styles.suggestionText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function playerListCard(
  player: PlayerCard,
  onOpen: () => void,
  onOpenHighlights: () => void,
  onMessagePlayer?: () => void,
  messageLabel = 'Message Player',
  showViewProfileAction = false,
) {
  if (showViewProfileAction) {
    return (
      <View key={player.id} style={styles.personCard}>
        <View style={styles.avatar}>
          {player.avatar ? <Image source={{ uri: player.avatar }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{player.name.slice(0, 2)}</Text>}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{player.name}</Text>
          <Text style={styles.cardText}>
            {(player.gender || 'UNSPECIFIED').toUpperCase()} | {player.position} | {player.team} | {player.age} | {player.nationality}
          </Text>
          <View style={styles.actionRowSplit}>
            <Pressable style={styles.lightBtnSmall} onPress={onOpen}>
              <Text style={styles.lightBtnText}>View Profile</Text>
            </Pressable>
            {onMessagePlayer ? (
              <Pressable
                style={styles.darkBtnSmall}
                onPress={() => {
                  void onMessagePlayer();
                }}
              >
                <Text style={styles.darkBtnText}>{messageLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <Pressable key={player.id} onPress={onOpen} style={styles.personCard}>
      <View style={styles.avatar}>
        {player.avatar ? <Image source={{ uri: player.avatar }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{player.name.slice(0, 2)}</Text>}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{player.name}</Text>
        <Text style={styles.cardText}>
          {(player.gender || 'UNSPECIFIED').toUpperCase()} | {player.position} | {player.team} | {player.age} | {player.nationality}
        </Text>
        <View style={styles.actionRowCompact}>
          <Pressable style={styles.lightAction} onPress={onOpenHighlights}>
            <Text style={styles.lightActionText}>Highlights Video</Text>
          </Pressable>
          {onMessagePlayer ? (
            <Pressable
              style={styles.darkAction}
              onPress={() => {
                void onMessagePlayer();
              }}
            >
              <Text style={styles.darkActionText}>{messageLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function playerDetailCard(
  player: PlayerCard,
  onBack: () => void,
  onOpenHighlights: () => void,
  onMessagePlayer?: () => void,
  messageLabel = 'Message Player',
) {
  const statItems = player.stats
    ? player.stats.split('|').map((item) => item.trim()).filter(Boolean)
    : [];

  return (
    <View style={styles.flatPanel}>
      <Pressable onPress={onBack} style={styles.inlineBack}>
        <Text style={styles.inlineBackText}>Back To Players</Text>
      </Pressable>
      <View style={styles.coachHero}>
        {player.avatar ? (
          <Image source={{ uri: player.avatar }} style={styles.profilePhoto} />
        ) : (
          <View style={styles.profileCircle}>
            <Text style={styles.profileCircleText}>{player.name.slice(0, 2)}</Text>
          </View>
        )}
        <Text style={styles.profileName}>{player.name}</Text>
        <Text style={styles.profileMeta}>{player.sport.toUpperCase()}</Text>
        <Text style={styles.profileMeta}>{player.position}</Text>
        <Text style={styles.profileMeta}>{player.team}</Text>
        <Text style={styles.profileMeta}>
          {[player.city, player.country].filter(Boolean).join(', ') || player.nationality}
        </Text>
      </View>
      <Text style={styles.section}>Player Details</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>
          {(player.gender || 'GENDER NOT PROVIDED').toUpperCase()} | {player.age ? `${player.age} YEARS OLD` : 'AGE NOT PROVIDED'} | {player.nationality}
        </Text>
      </View>
      {player.bio ? (
        <>
          <Text style={styles.section}>Biography</Text>
          <View style={styles.detailLineCard}>
            <Text style={styles.cardText}>{player.bio}</Text>
          </View>
        </>
      ) : null}
      {statItems.length ? (
        <>
          <Text style={styles.section}>Stats</Text>
          {statItems.map((item) => (
            <View key={item} style={styles.detailLineCard}>
              <Text style={styles.cardText}>{item}</Text>
            </View>
          ))}
        </>
      ) : null}
      <View style={styles.actionRowCompact}>
        <Pressable style={styles.lightAction} onPress={onOpenHighlights}>
          <Text style={styles.lightActionText}>Highlights Video</Text>
        </Pressable>
        {onMessagePlayer ? (
          <Pressable style={styles.darkAction} onPress={onMessagePlayer}>
            <Text style={styles.darkActionText}>{messageLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function coachListCard(
  coach: CoachCard,
  onOpen: () => void,
  onRequestContact: () => void,
) {
  return (
    <Pressable key={coach.id} onPress={onOpen} style={styles.personCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{coach.name.slice(0, 2)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{coach.name}</Text>
        <Text style={styles.cardText}>
          {coach.team} | {coach.location}
        </Text>
        <View style={styles.actionRowSplit}>
          <Pressable style={[styles.darkAction, styles.inlineAction]} onPress={onRequestContact}>
            <Text style={styles.darkActionText}>Request Contact</Text>
          </Pressable>
          <Pressable style={[styles.lightAction, styles.inlineAction]} onPress={onOpen}>
            <Text style={styles.lightActionText}>View Profile</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function coachDetailCard(
  coach: CoachCard,
  onBack: () => void,
  onRequestContact: () => void,
) {
  return (
    <View style={styles.flatPanel}>
      <Pressable onPress={onBack} style={styles.inlineBack}>
        <Text style={styles.inlineBackText}>Back To Coaches</Text>
      </Pressable>
      <View style={styles.coachHero}>
        <View style={styles.profileCircle}>
          <Text style={styles.profileCircleText}>{coach.name.slice(0, 2)}</Text>
        </View>
        <Text style={styles.profileName}>{coach.name}</Text>
        <Text style={styles.profileMeta}>{coach.team}</Text>
        <Text style={styles.profileMeta}>{coach.location}</Text>
      </View>
      <Text style={styles.section}>Profile</Text>
      <Text style={styles.cardText}>{coach.bio}</Text>
      <Text style={styles.section}>Trials</Text>
      {coach.trials.map((trial) => (
        <View key={trial} style={styles.detailLineCard}>
          <Text style={styles.cardText}>{trial}</Text>
        </View>
      ))}
      <Text style={styles.section}>Offers</Text>
      {coach.offers.map((offer) => (
        <View key={offer} style={styles.detailLineCard}>
          <Text style={styles.cardText}>{offer}</Text>
        </View>
      ))}
      <Pressable style={styles.darkBtn} onPress={onRequestContact}>
        <Text style={styles.darkBtnText}>Request Contact</Text>
      </Pressable>
    </View>
  );
}

function trialListCard(
  trial: TrialCard,
  onOpen: () => void,
) {
  return (
    <Pressable key={trial.id} onPress={onOpen} style={styles.personCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{trial.coachName.slice(0, 2)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{trial.coachName}</Text>
        <Text style={styles.cardText}>
          {trial.team} | {trial.time} - {trial.location}
        </Text>
        <Pressable style={styles.lightAction} onPress={onOpen}>
          <Text style={styles.lightActionText}>Open Trial</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function trialDetailCard(
  trial: TrialCard,
  onBack: () => void,
) {
  return (
    <View style={styles.flatPanel}>
      <Pressable onPress={onBack} style={styles.inlineBack}>
        <Text style={styles.inlineBackText}>Back To Trials</Text>
      </Pressable>
      <Text style={styles.profileName}>{trial.coachName}</Text>
      <Text style={styles.profileMeta}>{trial.team}</Text>
      <Text style={styles.section}>Time</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>{trial.time}</Text>
      </View>
      <Text style={styles.section}>Location</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>{trial.location}</Text>
      </View>
      <Text style={styles.section}>Description</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>{trial.description}</Text>
      </View>
      <Text style={styles.section}>Registration Link</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>{trial.registrationLink}</Text>
      </View>
    </View>
  );
}

function offerListCard(
  offer: OfferCard,
  onOpen: () => void,
  onMessageCoach: () => void,
  actionLabel = 'Request Contact',
) {
  return (
    <View key={offer.id} style={styles.personCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{offer.coachName.slice(0, 2)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{offer.coachName}</Text>
        <Text style={styles.cardText}>
          {offer.title} | {offer.target}
        </Text>
        <View style={styles.actionRowCompact}>
          <Pressable style={styles.darkAction} onPress={onMessageCoach}>
            <Text style={styles.darkActionText}>{actionLabel}</Text>
          </Pressable>
          <Pressable style={styles.lightAction} onPress={onOpen}>
            <Text style={styles.lightActionText}>Open Offer</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function offerDetailCard(
  offer: OfferCard,
  onBack: () => void,
  onMessageCoach: () => void,
  actionLabel = 'Request Contact',
) {
  return (
    <View style={styles.flatPanel}>
      <Pressable onPress={onBack} style={styles.inlineBack}>
        <Text style={styles.inlineBackText}>Back To Offers</Text>
      </Pressable>
      <Text style={styles.profileName}>{offer.coachName}</Text>
      <Text style={styles.profileMeta}>{offer.team}</Text>
      <Text style={styles.profileMeta}>{offer.location}</Text>
      <Text style={styles.section}>Offer</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>{offer.title}</Text>
      </View>
      <Text style={styles.section}>Target Player</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>{offer.target}</Text>
      </View>
      <Text style={styles.section}>Offer Details</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>{offer.details}</Text>
      </View>
      <Text style={styles.section}>Coach Profile</Text>
      <View style={styles.detailLineCard}>
        <Text style={styles.cardText}>
          {offer.coachName} leads {offer.team} in {offer.location}.
        </Text>
      </View>
      <Pressable style={styles.darkBtn} onPress={onMessageCoach}>
        <Text style={styles.darkBtnText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function conversationCard(conversation: ConversationThread, onOpen: () => void) {
  return (
    <Pressable key={conversation.id} onPress={onOpen} style={styles.personCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{conversation.name.slice(0, 2)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{conversation.name}</Text>
        <View style={styles.conversationPreviewRow}>
          <Text style={[styles.cardText, conversation.unreadCount ? styles.unreadConversationText : null]}>{conversation.preview}</Text>
          {conversation.unreadCount ? <View style={styles.unreadDot} /> : null}
        </View>
        <Pressable style={styles.lightAction} onPress={onOpen}>
          <Text style={styles.lightActionText}>Open Chat</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function conversationDetailCard(
  conversation: ConversationThread,
  draftMessage: string,
  setDraftMessage: (value: string) => void,
  onSend: () => void,
  onOpenProfile: () => void,
  onBack: () => void,
) {
  const conversationMeta = [conversation.position, conversation.age ? `${conversation.age} YEARS OLD` : '', conversation.team]
    .filter(Boolean)
    .join(' | ');

  return (
    <View style={styles.box}>
      <Pressable onPress={onBack} style={styles.inlineBack}>
        <Text style={styles.inlineBackText}>Back To Messages</Text>
      </Pressable>
      <Pressable onPress={onOpenProfile} style={styles.conversationHeaderPressable}>
        {conversation.avatar ? (
          <Image source={{ uri: conversation.avatar }} style={styles.conversationHeaderPhoto} />
        ) : (
          <View style={styles.conversationHeaderAvatar}>
            <Text style={styles.conversationHeaderAvatarText}>{conversation.name.slice(0, 2)}</Text>
          </View>
        )}
        <Text style={styles.profileName}>{conversation.name}</Text>
        {conversationMeta ? <Text style={styles.profileMeta}>{conversationMeta}</Text> : null}
      </Pressable>
      {conversation.messages.map((item, index) => (
        <View
          key={`${conversation.id}-${index}`}
          style={[styles.messageBubble, item.from === 'me' ? styles.messageBubbleMine : styles.messageBubbleTheirs]}
        >
          <Text style={[styles.messageBubbleText, item.from === 'me' ? styles.messageBubbleTextMine : null]}>{item.body}</Text>
        </View>
      ))}
      {conversation.pendingApproval ? (
        <View style={styles.detailLineCard}>
          <Text style={styles.cardText}>Request pending. You can continue this conversation after it is accepted.</Text>
        </View>
      ) : null}
      <View style={styles.messageComposer}>
        <TextInput
          value={draftMessage}
          onChangeText={setDraftMessage}
          style={styles.messageInput}
          placeholder={conversation.pendingApproval ? 'Waiting for acceptance' : 'Write your message'}
          editable={!conversation.pendingApproval}
          placeholderTextColor={colors.muted}
        />
        <Pressable
          style={[styles.darkAction, conversation.pendingApproval ? styles.disabledAction : null]}
          onPress={onSend}
          disabled={conversation.pendingApproval}
        >
          <Text style={styles.darkActionText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

function requestCard(
  request: (typeof initialRequestItems)[number],
  onBack: () => void,
  onAccept: () => void,
  onDelete: () => void,
  busy: boolean,
) {
  return (
    <View key={request.id} style={styles.box}>
      <Pressable onPress={onBack} style={styles.inlineBack}>
        <Text style={styles.inlineBackText}>Back To Messages</Text>
      </Pressable>
      <Text style={styles.cardName}>{request.name}</Text>
      <Text style={styles.cardText}>{request.text}</Text>
      <View style={styles.actionRowCompact}>
        <Pressable style={[styles.darkAction, busy ? styles.disabledAction : null]} onPress={() => !busy && onAccept()} disabled={busy}>
          <Text style={styles.darkActionText}>{busy ? 'Please wait...' : 'Accept'}</Text>
        </Pressable>
        <Pressable style={[styles.lightAction, busy ? styles.disabledAction : null]} onPress={() => !busy && onDelete()} disabled={busy}>
          <Text style={styles.lightActionText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function playerProfileCard(
  profile: {
    fullName: string;
    sport: Sport;
    age: string;
    gender: string;
    nationality: string;
    team: string;
    city: string;
    country: string;
    position: string;
    avatar: string;
    highlights: string;
    stats: string;
  },
  onEdit: () => void,
  onLogout: () => void,
  onOpenHighlights: () => void,
  onOpenPrivacyPolicy: () => void,
  onOpenTermsOfService: () => void,
) {
  const statItems = profile.stats
    ? profile.stats.split('|').map((item) => item.trim()).filter(Boolean)
    : [];
  const teamWithLocation = [profile.team, [profile.city, profile.country].filter(Boolean).join(', ')].filter(Boolean).join(' | ');

  return (
    <View style={styles.playerProfileShell}>
      <Text style={styles.playerProfileHeading}>Player Card</Text>
      {profile.avatar ? (
        <Image source={{ uri: profile.avatar }} style={styles.playerAvatarLarge} />
      ) : (
        <View style={styles.playerAvatarLarge}>
          <Text style={styles.playerAvatarLargeText}>{profile.fullName ? profile.fullName.slice(0, 2).toUpperCase() : 'GS'}</Text>
        </View>
      )}
      <Text style={styles.playerProfileName}>{profile.fullName || 'PLAYER NAME'}</Text>
      <Text style={styles.playerProfileSport}>{profile.sport.toUpperCase()}</Text>
      <View style={styles.playerProfileGrid}>
        <View style={styles.playerInfoColumn}>
          <Text style={styles.playerInfoLine}>Age: {profile.age || 'NOT SET'}</Text>
          <Text style={styles.playerInfoLine}>Gender: {profile.gender ? profile.gender.toUpperCase() : 'NOT SET'}</Text>
          <Text style={styles.playerInfoLine}>Nationality: {profile.nationality || 'NOT SET'}</Text>
          <Text style={styles.playerInfoLine}>Team: {teamWithLocation || 'NOT SET'}</Text>
          <Text style={styles.playerInfoLine}>Position: {profile.position || 'NOT SET'}</Text>
        </View>
        <View style={styles.playerStatsColumn}>
          {statItems.length ? (
            statItems.map((item) => (
              <View key={item} style={styles.playerStatPill}>
                <Text style={styles.playerStatText}>{item}</Text>
              </View>
            ))
          ) : (
            <View style={styles.playerStatPill}>
              <Text style={styles.playerStatText}>NO STATS ADDED YET</Text>
            </View>
          )}
        </View>
      </View>
      <Pressable style={styles.playerHighlightButton} onPress={onOpenHighlights}>
        <Text style={styles.playerHighlightButtonText}>Highlight Video</Text>
      </Pressable>
      <View style={styles.playerProfileActions}>
        {glossyGoldButton('Edit Profile', onEdit, styles.playerPrimaryAction)}
        {glossyGoldButton('Log Out', onLogout, styles.playerPrimaryAction)}
      </View>
      <View style={styles.profileLegalLinks}>
        <Pressable onPress={onOpenPrivacyPolicy}>
          <Text style={styles.profileLegalLink}>Privacy Policy</Text>
        </Pressable>
        <Pressable onPress={onOpenTermsOfService}>
          <Text style={styles.profileLegalLink}>Terms of Service</Text>
        </Pressable>
      </View>
    </View>
  );
}

function glossyGoldButton(
  label: string,
  onPress: () => void,
  containerStyle?: object,
  textStyle?: object,
) {
  return (
    <Pressable onPress={onPress} style={containerStyle}>
      <LinearGradient colors={metallicGoldGradient} end={{ x: 1, y: 0.5 }} start={{ x: 0, y: 0.5 }} style={styles.glossyGoldButton}>
        <View style={styles.glossyGoldShine} />
        <Text style={[styles.glossyGoldButtonText, textStyle]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function bottomNavIcon(tab: Tab, active: boolean, badgeCount = 0) {
  const color = active ? colors.gold : '#6C788A';
  const glow = active ? 'rgba(212, 175, 55, 0.38)' : 'rgba(108, 120, 138, 0.18)';

  if (tab === 'explore') {
    return (
      <View style={[styles.bottomIcon, active ? styles.bottomIconActive : null]}>
        <Svg height={34} viewBox="0 0 36 36" width={34}>
          <Circle cx="15" cy="15" fill="none" r="9" stroke={color} strokeWidth="2.4" />
          <Line stroke={color} strokeLinecap="round" strokeWidth="2.6" x1="21.5" x2="30" y1="21.5" y2="30" />
          <Circle cx="12" cy="12" fill={glow} r="1.6" />
        </Svg>
      </View>
    );
  }

  if (tab === 'messages') {
    return (
      <View style={[styles.bottomIcon, active ? styles.bottomIconActive : null]}>
        <Svg height={34} viewBox="0 0 36 36" width={34}>
          <Path
            d="M8 8.5h20a4.5 4.5 0 0 1 4.5 4.5v9a4.5 4.5 0 0 1-4.5 4.5H16l-6.8 5.3c-.8.6-1.9-.1-1.7-1.1l1-4.2H8A4.5 4.5 0 0 1 3.5 22v-9A4.5 4.5 0 0 1 8 8.5Z"
            fill="none"
            stroke={color}
            strokeLinejoin="round"
            strokeWidth="2.3"
          />
          <Rect fill={glow} height="1.8" rx="0.9" width="8" x="10" y="12.3" />
        </Svg>
        {badgeCount > 0 ? (
          <View style={styles.bottomBadge}>
            <Text style={styles.bottomBadgeText}>{badgeCount > 9 ? '9+' : String(badgeCount)}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.bottomIcon, active ? styles.bottomIconActive : null]}>
      <Svg height={35} viewBox="0 0 36 36" width={35}>
        <Circle cx="18" cy="18" fill="none" r="14" stroke={color} strokeWidth="2.3" />
        <Circle cx="18" cy="13.5" fill="none" r="4.5" stroke={color} strokeWidth="2.3" />
        <Path d="M10.2 27.2c1.8-4.3 5-6.4 7.8-6.4 2.8 0 6 2.1 7.8 6.4" fill="none" stroke={color} strokeLinecap="round" strokeWidth="2.3" />
      </Svg>
    </View>
  );
}

function deleteActionIcon() {
  return (
    <Svg height={18} viewBox="0 0 24 24" width={18}>
      <Path
        d="M8 4.5h8M9.2 4.5l.5-1.1c.2-.5.7-.9 1.3-.9h2c.6 0 1.1.4 1.3.9l.5 1.1M5.5 7h13M8 7l.7 11c0 .8.7 1.5 1.5 1.5h3.6c.8 0 1.5-.7 1.5-1.5L16 7M10 10v6M14 10v6"
        fill="none"
        stroke={colors.goldSoft}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </Svg>
  );
}

function formCard(
  title: string,
  fields: Array<[string, string, (value: string) => void]>,
  onPublish: () => void,
  onDelete: () => void,
) {
  return (
    <View style={styles.box}>
      <Text style={styles.section}>{title}</Text>
      {fields.map(([label, value, setValue]) => (
        <View key={label}>{input(label, value, setValue)}</View>
      ))}
      <View style={styles.row}>
        <Pressable style={styles.darkBtnSmall} onPress={onPublish}>
          <Text style={styles.darkBtnText}>Publish</Text>
        </Pressable>
        <Pressable style={styles.lightBtnSmall} onPress={onDelete}>
          <Text style={styles.lightBtnText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  wrap: { minHeight: '100%', paddingHorizontal: 30, paddingVertical: 40, backgroundColor: colors.bg, flexGrow: 1 },
  appWrap: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 132, backgroundColor: colors.bg, flexGrow: 1 },
  logo: { alignSelf: 'center', height: 290, marginBottom: 60, width: 290 },
  brand: {
      color: colors.goldSoft,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 42,
    letterSpacing: 0.4,
    marginBottom: 34,
    textAlign: 'center',
      textShadowColor: 'rgba(212, 175, 55, 0.42)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  sub: { color: colors.muted, fontFamily: 'Montserrat_500Medium', fontSize: 14, lineHeight: 24, marginBottom: 28, textAlign: 'center' },
  title: {
      color: colors.goldSoft,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    letterSpacing: 0.3,
    marginBottom: 14,
      textShadowColor: 'rgba(212, 175, 55, 0.34)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  heroBtn: {
    alignSelf: 'center',
    elevation: 6,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: '88%',
  },
  heroBtnText: { color: '#0B0F19', fontFamily: 'Montserrat_700Bold', fontSize: 15, letterSpacing: 0.5, textAlign: 'center', textTransform: 'uppercase' },
  glossyGoldButton: {
    alignItems: 'center',
    borderColor: 'rgba(212, 175, 55, 0.45)',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 14,
    position: 'relative',
  },
  glossyGoldShine: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: '45%',
    left: 8,
    position: 'absolute',
    right: 8,
    top: 5,
  },
  glossyGoldButtonText: {
    color: '#0B0F19',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  inputBox: { marginBottom: 16 },
  inputLabel: { color: colors.text, fontFamily: 'Montserrat_600SemiBold', fontSize: 15, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    color: colors.text,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    paddingHorizontal: 0,
    paddingVertical: 6,
  },
  line: { backgroundColor: colors.line, height: 1, marginTop: 8 },
  row: { flexDirection: 'row', gap: 16 },
  messagesToolbar: { marginBottom: 18 },
  flex: { flex: 1 },
  section: { color: colors.text, fontFamily: 'Montserrat_600SemiBold', fontSize: 18, letterSpacing: 0.6, marginBottom: 12, marginTop: 8, textTransform: 'uppercase' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  modePillsCompact: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, marginBottom: 16 },
  modePillsTight: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, marginBottom: 16 },
  compactPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modePillCompact: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modePillTight: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  compactPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: colors.gold },
  pillText: { color: colors.text, fontFamily: 'Montserrat_600SemiBold', fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  modePillTextCompact: { fontSize: 11, letterSpacing: 0.2, textAlign: 'center' },
  modePillTextTight: { fontSize: 9, letterSpacing: 0.1, textAlign: 'center' },
  compactPillText: { fontSize: 11, letterSpacing: 0.25 },
  pillTextActive: { color: colors.bgDeep },
  darkPill: { backgroundColor: colors.card, borderColor: colors.gold },
  darkPillText: { color: colors.goldSoft },
  darkBtn: {
    backgroundColor: colors.dark,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 18,
    paddingVertical: 18,
  },
  darkBtnSmall: {
    backgroundColor: colors.dark,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  darkBtnText: { color: colors.goldSoft, fontFamily: 'Montserrat_700Bold', fontSize: 15, letterSpacing: 0.6, textAlign: 'center', textTransform: 'uppercase' },
  lightBtnSmall: {
      backgroundColor: 'transparent',
      borderColor: '#3A4456',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  lightBtnText: { color: colors.muted, fontFamily: 'Montserrat_700Bold', fontSize: 15, letterSpacing: 0.6, textAlign: 'center', textTransform: 'uppercase' },
  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sportCard: {
      backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    width: '47%',
  },
  sportCardActive: { backgroundColor: colors.cardElevated, borderColor: colors.goldSoft },
  sportText: { color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 16, letterSpacing: 0.5, textAlign: 'center' },
  sportTextActive: { color: colors.goldSoft },
  box: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  flatPanel: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  personCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    padding: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    borderColor: colors.gold,
    borderRadius: 100,
    borderWidth: 1.5,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  avatarText: { color: colors.goldSoft, fontFamily: 'Montserrat_700Bold', fontSize: 18 },
  avatarImage: {
    borderRadius: 100,
    height: '100%',
    width: '100%',
  },
  cardBody: { flex: 1, gap: 6, paddingTop: 2 },
  conversationPreviewRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  conversationHeaderPressable: {
    alignItems: 'center',
    marginBottom: 6,
  },
  conversationHeaderAvatar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.cardElevated,
    borderColor: colors.goldSoft,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 96,
    justifyContent: 'center',
    marginBottom: 14,
    width: 96,
  },
  conversationHeaderAvatarText: {
    color: colors.goldSoft,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
  },
  conversationHeaderPhoto: {
    alignSelf: 'center',
    borderColor: colors.goldSoft,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 96,
    marginBottom: 14,
    width: 96,
  },
  unreadConversationText: { fontFamily: 'Montserrat_700Bold', color: colors.goldSoft },
  unreadDot: {
    backgroundColor: colors.goldSoft,
    borderRadius: 999,
    height: 10,
    minWidth: 10,
    width: 10,
  },
  actionRowCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  actionRowSplit: { flexDirection: 'row', gap: 8, marginTop: 2 },
  inlineAction: { flex: 1 },
  inlineFilterPanel: {
    marginTop: 14,
    marginBottom: 18,
  },
  inlineFilterSpacer: { height: 16 },
  locationFilterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardName: {
    color: colors.goldSoft,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(212, 175, 55, 0.24)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  cardText: { color: colors.text, fontFamily: 'Montserrat_500Medium', fontSize: 13, lineHeight: 19 },
  lightAction: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderColor: '#3A4456',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  lightActionText: { color: colors.muted, fontFamily: 'Montserrat_700Bold', fontSize: 12, letterSpacing: 0.35, textTransform: 'uppercase' },
  darkAction: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dark,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  disabledAction: {
    opacity: 0.45,
  },
  darkActionText: { color: colors.goldSoft, fontFamily: 'Montserrat_700Bold', fontSize: 12, letterSpacing: 0.35, textTransform: 'uppercase' },
  photoPickerButton: {
    backgroundColor: colors.dark,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  photoPickerButtonText: {
    color: colors.goldSoft,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  editPhotoPreview: {
    alignSelf: 'center',
    borderColor: colors.goldSoft,
    borderRadius: 90,
    borderWidth: 1.5,
    height: 160,
    marginBottom: 18,
    width: 160,
  },
  editPhotoPreviewSmall: {
    alignSelf: 'center',
    borderColor: colors.goldSoft,
    borderRadius: 70,
    borderWidth: 1.5,
    height: 120,
    marginBottom: 18,
    width: 120,
  },
  profileImageButton: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    position: 'relative',
  },
  profileImageButtonPhoto: {
    borderColor: colors.goldSoft,
    borderRadius: 120,
    borderWidth: 1.5,
    height: 160,
    width: 160,
  },
  profileImageButtonAvatar: {
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    borderColor: colors.goldSoft,
    borderRadius: 120,
    borderWidth: 1.5,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  profileImageButtonAvatarText: {
    color: colors.goldSoft,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 44,
  },
  profileImageButtonBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.84)',
    borderColor: colors.goldSoft,
    borderRadius: 999,
    borderWidth: 1,
    bottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
  },
  profileImageButtonBadgeText: {
    color: colors.goldSoft,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  cityHint: { color: colors.text, fontFamily: 'Montserrat_500Medium', fontSize: 14, marginBottom: 8, opacity: 0.9 },
  filterHint: {
    color: colors.muted,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  suggestionList: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 10,
    overflow: 'hidden',
  },
  suggestionItem: {
    borderBottomColor: 'rgba(212, 175, 55, 0.12)',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionText: {
    color: colors.text,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
  },
  searchBar: {
    backgroundColor: 'transparent',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    color: colors.text,
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 15,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  searchText: { color: colors.text, fontFamily: 'Montserrat_500Medium', fontSize: 15 },
  requestPill: {
    alignItems: 'center',
    backgroundColor: colors.pink,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 150,
    paddingHorizontal: 16,
  },
  requestText: { color: colors.gold, fontFamily: 'Montserrat_700Bold', fontSize: 15, letterSpacing: 0.45, textTransform: 'uppercase' },
  playerProfileShell: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 26,
  },
  playerProfileHeading: {
    color: colors.goldSoft,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 28,
    letterSpacing: 0.6,
    marginBottom: 28,
    textShadowColor: 'rgba(212, 175, 55, 0.24)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    textTransform: 'uppercase',
  },
  playerAvatarLarge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.cardElevated,
    borderRadius: 130,
    height: 220,
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    width: 220,
  },
  playerAvatarLargeText: {
    color: colors.goldSoft,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 58,
  },
  playerProfileName: {
    color: colors.text,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  playerProfileSport: {
    color: colors.gold,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    letterSpacing: 1.2,
    marginBottom: 28,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  playerProfileGrid: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  playerInfoColumn: {
    flex: 1,
    gap: 12,
    justifyContent: 'flex-start',
  },
  playerInfoLine: {
    color: colors.text,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  playerStatsColumn: {
    alignItems: 'flex-end',
    gap: 10,
    justifyContent: 'flex-start',
  },
  playerStatPill: {
    backgroundColor: colors.bgDeep,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  playerStatText: {
    color: colors.text,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  playerHighlightButton: {
    alignSelf: 'center',
    backgroundColor: colors.gold,
    borderRadius: 999,
    marginBottom: 24,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  playerHighlightButtonText: {
    color: '#0B0F19',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    textTransform: 'uppercase',
  },
  playerProfileActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  profileLegalLinks: {
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  profileLegalLink: {
    color: colors.goldSoft,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  playerPrimaryAction: {
    flex: 1,
  },
  playerPrimaryActionText: {
    color: '#0B0F19',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  profileCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.cardElevated,
    borderColor: colors.goldSoft,
    borderRadius: 120,
    borderWidth: 1.5,
    height: 160,
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: 160,
  },
  profilePhoto: {
    alignSelf: 'center',
    borderColor: colors.goldSoft,
    borderRadius: 120,
    borderWidth: 1.5,
    height: 160,
    marginBottom: 18,
    width: 160,
  },
  profileCircleText: { color: colors.goldSoft, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 44 },
  profileName: {
    color: colors.goldSoft,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(212, 175, 55, 0.24)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    textTransform: 'uppercase',
  },
  profileMeta: { color: colors.text, fontFamily: 'Montserrat_500Medium', fontSize: 15, lineHeight: 22, opacity: 0.94, textAlign: 'center' },
  inlineBack: { alignSelf: 'flex-start', marginBottom: 16 },
  inlineBackText: { color: colors.goldSoft, fontFamily: 'Montserrat_600SemiBold', fontSize: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  coachHero: { alignItems: 'center', marginBottom: 10 },
  inlineItemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  inlineItemText: {
    flex: 1,
  },
  inlineDeleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 28,
  },
  detailLineCard: {
      backgroundColor: 'transparent',
      borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginBottom: 10,
    paddingBottom: 14,
    paddingTop: 2,
  },
  messageBubble: {
    borderRadius: 20,
    marginBottom: 12,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.gold,
  },
  messageBubbleText: {
    color: colors.text,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    lineHeight: 21,
  },
  messageBubbleTextMine: {
    color: colors.bgDeep,
  },
  messageComposer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  messageInput: {
    backgroundColor: 'transparent',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    color: colors.text,
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 15,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  bottom: {
      backgroundColor: colors.bg,
      borderTopColor: colors.border,
      borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    left: 0,
    paddingBottom: 22,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  bottomItem: { alignItems: 'center', gap: 4 },
  bottomIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.96,
    position: 'relative',
  },
  bottomIconActive: {
    opacity: 1,
    transform: [{ scale: 1.04 }],
  },
  bottomBadge: {
    alignItems: 'center',
    backgroundColor: colors.goldSoft,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -8,
    top: -6,
  },
  bottomBadgeText: {
    color: colors.bgDeep,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
  bottomLabel: { color: colors.muted, fontFamily: 'Montserrat_500Medium', fontSize: 12, letterSpacing: 0.35 },
  bottomLabelActive: { color: colors.goldSoft },
  altLink: { color: colors.text, fontFamily: 'Montserrat_500Medium', fontSize: 15, marginTop: 18, textAlign: 'center' },
  errorText: { color: '#ffb4b4', fontFamily: 'Montserrat_500Medium', fontSize: 14, lineHeight: 20, marginTop: 14, textAlign: 'center' },
});
