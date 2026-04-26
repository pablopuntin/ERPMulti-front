"use client";

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-gray-300 bg-background text-foreground p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
    />
  );
}
