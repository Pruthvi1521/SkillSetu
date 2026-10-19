import React from 'react';

export interface SkillSetuEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SkillSetuEmblem({ size = 'md', className = '' }: SkillSetuEmblemProps) {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14'
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 shadow-sm border border-indigo-500/20 shrink-0 ${sizeMap[size]} ${className}`}
      aria-label="SkillSetu Verified Competency Emblem"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[72%] h-[72%]"
      >
        {/* Subtle bridge arc connecting foundation */}
        <path
          d="M6 25.5C9.5 23 22.5 23 26 25.5"
          stroke="#A5B4FC"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.4"
        />

        {/* Graduation cap mortarboard top / diamond */}
        <path
          d="M16 6.5L26 11.5L16 16.5L6 11.5L16 6.5Z"
          fill="#FFFFFF"
        />

        {/* Tassel drop & node representing connected learning path */}
        <path
          d="M26 11.5V17"
          stroke="#C7D2FE"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="26" cy="17.5" r="1.1" fill="#E0E7FF" />

        {/* Verified competency checkmark / bridge arch */}
        <path
          d="M10 20.5L14.2 24.5L22.5 16"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export interface SkillSetuLogoProps {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  badge?: string;
  subtitle?: string;
  className?: string;
}

export function SkillSetuLogo({
  showText = true,
  size = 'md',
  badge = 'NSQF RPL',
  subtitle = 'Prior Learning Assessment Platform',
  className = ''
}: SkillSetuLogoProps) {
  const textSizeMap = {
    sm: { title: 'text-base', badge: 'text-[9px]', subtitle: 'text-[10px]' },
    md: { title: 'text-lg', badge: 'text-[10px]', subtitle: 'text-xs' },
    lg: { title: 'text-2xl', badge: 'text-xs', subtitle: 'text-sm' }
  };

  const currentTextSize = textSizeMap[size];

  if (!showText) {
    return <SkillSetuEmblem size={size} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <SkillSetuEmblem size={size} />
      <div>
        <div className={`font-bold tracking-tight text-slate-900 flex items-center gap-2 ${currentTextSize.title}`}>
          <span>SkillSetu</span>
          {badge && (
            <span
              className={`uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 ${currentTextSize.badge}`}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <div className={`text-slate-500 font-medium leading-none mt-0.5 ${currentTextSize.subtitle}`}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
