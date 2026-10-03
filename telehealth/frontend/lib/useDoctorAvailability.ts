"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "telehealth-doctor-online";

export function useDoctorAvailability() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(window.localStorage.getItem(STORAGE_KEY) !== "false");
  }, []);

  const updateOnline = useCallback((value: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, String(value));
    setOnline(value);
  }, []);

  return [online, updateOnline] as const;
}