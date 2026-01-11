declare module "lucia" {
  interface Register {
    DatabaseUserAttributes: {
      email: string;
      firstName: string | null;
      lastName: string | null;
      name: string | null;
      phone: string | null;
      role: "USER" | "ADMIN";
      status: "PENDING" | "ACTIVE" | "DISABLED";
    };
  }
}

export {};

