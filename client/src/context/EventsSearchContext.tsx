import React, { createContext, useContext, useState, ReactNode } from "react";

interface EventsSearchContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

// Provide a safe default so hooks can be used even if provider is temporarily missing
const EventsSearchContext = createContext<EventsSearchContextType>({
  searchTerm: '',
  setSearchTerm: () => {},
});

export const EventsSearchProvider = ({ children }: { children: ReactNode }) => {
  const [searchTerm, setSearchTerm] = useState("");
  return (
    <EventsSearchContext.Provider value={{ searchTerm, setSearchTerm }}>
      {children}
    </EventsSearchContext.Provider>
  );
};

export const useEventsSearch = () => {
  return useContext(EventsSearchContext);
};
