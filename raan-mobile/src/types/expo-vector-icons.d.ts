declare module '@expo/vector-icons' {
  import { ComponentProps } from 'react';
  import { TextProps } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export const Ionicons: React.ComponentType<IconProps>;
  export const MaterialIcons: React.ComponentType<IconProps>;
  export const FontAwesome: React.ComponentType<IconProps>;
  export const Feather: React.ComponentType<IconProps>;
  export const AntDesign: React.ComponentType<IconProps>;
  export const Entypo: React.ComponentType<IconProps>;
  export const EvilIcons: React.ComponentType<IconProps>;
  export const FontAwesome5: React.ComponentType<IconProps>;
  export const Foundation: React.ComponentType<IconProps>;
  export const MaterialCommunityIcons: React.ComponentType<IconProps>;
  export const Octicons: React.ComponentType<IconProps>;
  export const SimpleLineIcons: React.ComponentType<IconProps>;
  export const Zocial: React.ComponentType<IconProps>;
}
