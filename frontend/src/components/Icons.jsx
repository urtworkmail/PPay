const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const HomeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
  </svg>
);

export const ListIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <rect x="3" y="10" width="18" height="4" rx="1" />
    <rect x="3" y="16" width="18" height="4" rx="1" />
  </svg>
);

export const LinkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M11 6.5 12.6 4.9a3.5 3.5 0 0 1 5 5L16 11.4" />
    <path d="M13 17.5 11.4 19.1a3.5 3.5 0 0 1-5-5L8 12.6" />
  </svg>
);

export const InvoiceIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14.5 3v4.5H19" />
    <path d="M8 12h8M8 15.5h8M8 8.5h4" />
  </svg>
);

export const UsersIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19c.5-3.2 3-5 5.5-5s5 1.8 5.5 5" />
    <circle cx="17" cy="8.5" r="2.3" />
    <path d="M15.8 14.2c1.9.3 3.5 1.9 3.9 4.3" />
  </svg>
);

export const KeyIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12 19 4M16.5 6.5 19 4l1.5 1.5-2.5 2.5M14.7 9l1.8 1.8" />
  </svg>
);

export const WebhookIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M8 18a3 3 0 1 1 2-5.2L14 7.6" />
    <path d="M16 6a3 3 0 1 1 1.8 5.4L13 7.2" />
    <path d="M14 19a3 3 0 1 0 5-2.3L14.5 12" />
  </svg>
);

export const BankIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 10 12 4l9 6" />
    <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
    <path d="M3 19h18" />
  </svg>
);

export const RocketIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M13.5 3.5c3 .5 5 2.5 5.5 5.5-2 3-4 5-7.5 8-1-1-2-2-2-2s-1-1-2-2c3-3.5 5-5.5 8-7.5Z" />
    <path d="M9 15c-2 0-4 1.5-4.5 4.5C7.5 19 9 17 9 15Z" />
    <circle cx="14.5" cy="9.5" r="1.3" />
  </svg>
);

export const HelpIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.2 1-1.2 1.9" />
    <circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="none" />
  </svg>
);

export const SunIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </svg>
);

export const MoonIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
);

export const MonitorIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
    <path d="M8 20h8M12 16.5V20" />
  </svg>
);

export const ChevronDownIcon = (p) => (
  <svg {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const CopyIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="1.5" />
    <path d="M6 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" />
  </svg>
);

export const ExternalLinkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 10 14" />
    <path d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5" />
  </svg>
);

export const PlusIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ArrowLeftIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const SearchIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.3-4.3" />
  </svg>
);

export const BellIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const SettingsIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
  </svg>
);

export const UserCircleIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3" />
    <path d="M5.8 18.5a6.5 6.5 0 0 1 12.4 0" />
  </svg>
);

export const XIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const BoxIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
    <path d="M3 7.5V16l9 4.5 9-4.5V7.5" />
    <path d="M12 12v8.5" />
  </svg>
);

export const ChartIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 20V10M11 20V4M18 20v-7" />
    <path d="M3 20h18" />
  </svg>
);

export const ChartLineIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 16.5 9 11l4 3 7-8" />
    <path d="M3 20h18M3 4v16" />
  </svg>
);

export const DatabaseIcon = (p) => (
  <svg {...base} {...p}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5V18c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
);

export const RefreshIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8" />
    <path d="M20 4v4h-4" />
    <path d="M20 12a8 8 0 0 1-13.7 5.7L4 16" />
    <path d="M4 20v-4h4" />
  </svg>
);

export const CardIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="M3 10h18" />
    <path d="M7 14.5h4" />
  </svg>
);

export const FingerprintIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.5c-3.9 0-7 3.1-7 7v2.5c0 3.4 1.4 6.2 3.4 8" />
    <path d="M12 3.5c3.9 0 7 3.1 7 7v2.5c0 1.7-.3 3.2-.9 4.5" />
    <path d="M8.5 10.5v2.5c0 3 1.2 5.4 3 7.2" />
    <path d="M15.5 10.5v2.5c0 1.4-.2 2.7-.6 3.8" />
    <path d="M12 8v5c0 2.6.9 4.8 2.3 6.5" />
  </svg>
);

export const PercentIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 19 19 5" />
    <circle cx="7" cy="7" r="2.3" />
    <circle cx="17" cy="17" r="2.3" />
  </svg>
);

export const WorkflowIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="6" height="5" rx="1.2" />
    <rect x="15" y="4" width="6" height="5" rx="1.2" />
    <rect x="9" y="15" width="6" height="5" rx="1.2" />
    <path d="M6 9v2a2 2 0 0 0 2 2h1M18 9v2a2 2 0 0 1-2 2h-1M12 13v2" />
  </svg>
);

export const ShieldIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.6 3 7.7 7 9 4-1.3 7-4.4 7-9V6l-7-2.5Z" />
    <path d="m9 12 2 2 4-4.2" />
  </svg>
);

export const PinIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 17v4" />
    <path d="M7 10.5 6 14h12l-1-3.5" />
    <path d="M8.5 3.5h7l-.7 6.2L17 12H7l2.2-2.3-.7-6.2Z" />
  </svg>
);

export const ChevronLeftIcon = (p) => (
  <svg {...base} {...p}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const GripIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const AlertIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 4 3 20h18L12 4Z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="none" />
  </svg>
);

export const TerminalIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
    <path d="m7 9.5 3 2.5-3 2.5M12 15.5h5" />
  </svg>
);

export const TrendUpIcon = (p) => (
  <svg {...base} {...p}>
    <path d="m3.5 16 6-6.5 4 4L20.5 6" />
    <path d="M14.5 6h6v6" />
  </svg>
);

export const LifeBuoyIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="m6.3 6.3 3.3 3.3M18 18l-3.4-3.4M6.3 18l3.3-3.4M18 6l-3.4 3.4" />
  </svg>
);

export const ClipboardIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="6" y="4.5" width="12" height="16" rx="1.5" />
    <path d="M9.5 4.5V3.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.7" />
    <path d="M9 10h6M9 13.5h6M9 17h4" />
  </svg>
);

export const CompassIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-2 5.5L9 16l2-5.5Z" />
  </svg>
);

export const IdCardIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <circle cx="8.5" cy="11" r="1.8" />
    <path d="M6 15.3c.4-1.3 1.3-2 2.5-2s2.1.7 2.5 2" />
    <path d="M14 9.5h4M14 13h4" />
  </svg>
);

export const ReceiptIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z" />
    <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5" />
  </svg>
);

export const PlugIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M9 3v5M15 3v5" />
    <path d="M7 8h10v3a5 5 0 0 1-10 0V8Z" />
    <path d="M12 16v5" />
  </svg>
);

export const CheckIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 13l4.5 4.5L19 7" />
  </svg>
);

export const PencilIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 20l.9-4 10.6-10.6a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L8 19l-4 1z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const LogoutIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3" />
    <path d="M14 8l4 4-4 4" />
    <path d="M18 12H9" />
  </svg>
);

export const BookIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 5.5c2-1 5-1 8 .5 3-1.5 6-1.5 8-.5v13c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5Z" />
    <path d="M12 6v13" />
  </svg>
);
