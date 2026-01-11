import React from 'react';
import { getAvatarUrl } from '@/utils/avatarUtils';

interface UserAvatarProps {
  userId?: string;
  username?: string;
  size?: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function UserAvatar({ userId, username, size = 40, className = "", onClick }: UserAvatarProps) {
  const avatarUrl = getAvatarUrl(userId || '', username);

  return (
    <img
      src={avatarUrl}
      alt={`${username || 'User'} avatar`}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onClick={onClick}
    />
  );
}