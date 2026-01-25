import { createContext, useContext } from 'react';
import type { User } from '../services/api';

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
}

export const UserContext = createContext<UserContextType>({
    user: null,
    setUser: () => { },
});

export function useUser() {
    return useContext(UserContext);
}
