import React from 'react';

const initialsOf = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export default function Avatar({ user, size = 32 }) {
  const name = user?.displayName || user?.email?.split('@')[0] || '';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (user?.photoURL) {
    return <img className="app-avatar" src={user.photoURL} alt="" style={style} referrerPolicy="no-referrer" />;
  }
  return <span className="app-avatar app-avatar--initials" style={style} aria-hidden="true">{initialsOf(name)}</span>;
}
