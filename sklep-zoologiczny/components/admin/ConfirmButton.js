'use client';

// Przycisk wysyłający formularz dopiero po potwierdzeniu
export default function ConfirmButton({ message, className = 'link-btn danger', children }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
