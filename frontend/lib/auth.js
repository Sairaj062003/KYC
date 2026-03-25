// USER session — key: 'kyc_user_token' / 'kyc_user'
export const userAuth = {
    setSession: (token, user) => {
        localStorage.setItem('kyc_user_token', token);
        localStorage.setItem('kyc_user', JSON.stringify(user));
    },
    getToken: () => localStorage.getItem('kyc_user_token'),
    getUser: () => {
        const u = localStorage.getItem('kyc_user');
        return u ? JSON.parse(u) : null;
    },
    clear: () => {
        localStorage.removeItem('kyc_user_token');
        localStorage.removeItem('kyc_user');
    },
    isLoggedIn: () => !!localStorage.getItem('kyc_user_token'),
};

// ADMIN session — key: 'kyc_admin_token' / 'kyc_admin' (completely separate)
export const adminAuth = {
    setSession: (token, user) => {
        localStorage.setItem('kyc_admin_token', token);
        localStorage.setItem('kyc_admin', JSON.stringify(user));
    },
    getToken: () => localStorage.getItem('kyc_admin_token'),
    getUser: () => {
        const u = localStorage.getItem('kyc_admin');
        return u ? JSON.parse(u) : null;
    },
    clear: () => {
        localStorage.removeItem('kyc_admin_token');
        localStorage.removeItem('kyc_admin');
    },
    isLoggedIn: () => !!localStorage.getItem('kyc_admin_token'),
};
