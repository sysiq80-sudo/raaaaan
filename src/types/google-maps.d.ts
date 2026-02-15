// Google Maps TypeScript definitions for global namespace
// This allows us to use google.maps API without importing specific types

declare global {
  // Google Maps auth failure callback
  interface Window {
    gm_authFailure?: () => void;
  }

  namespace google {
    namespace maps {
      interface LatLng {
        lat(): number;
        lng(): number;
      }

      interface LatLngBounds {
        extend(point: LatLng | { lat: number; lng: number }): void;
        contains(point: LatLng): boolean;
        toString(): string;
      }

      interface Size {
        width: number;
        height: number;
      }

      interface Point {
        x: number;
        y: number;
      }

      interface Icon {
        url?: string;
        size?: Size;
        origin?: Point;
        anchor?: Point;
        scaledSize?: Size;
      }

      interface MarkerOptions {
        position?: LatLng | { lat: number; lng: number };
        map?: Map | null;
        title?: string;
        icon?: string | Icon | google.maps.MarkerImage;
        draggable?: boolean;
        animation?: Animation;
        opacity?: number;
        zIndex?: number;
      }

      interface PolylineOptions {
        clickable?: boolean;
        draggable?: boolean;
        editable?: boolean;
        geodesic?: boolean;
        icons?: IconSequence[];
        map?: Map;
        path?: Array<LatLng | { lat: number; lng: number }>;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        visible?: boolean;
        zIndex?: number;
      }

      interface PolygonOptions extends PolylineOptions {
        fill?: boolean;
        fillColor?: string;
        fillOpacity?: number;
        paths?: Array<Array<LatLng | { lat: number; lng: number }>> | Array<LatLng | { lat: number; lng: number }>;
      }

      interface MapOptions {
        backgroundColor?: string;
        center?: LatLng | { lat: number; lng: number };
        clickableIcons?: boolean;
        disableDefaultUI?: boolean;
        disableDoubleClickZoom?: boolean;
        draggable?: boolean;
        draggableCursor?: string;
        draggingCursor?: string;
        fullscreenControl?: boolean;
        fullscreenControlOptions?: FullscreenControlOptions;
        gestureHandling?: "greedy" | "aggressive" | "auto" | "none" | "cooperative";
        heading?: number;
        keyboardShortcuts?: boolean;
        mapId?: string;
        mapTypeControl?: boolean;
        mapTypeControlOptions?: MapTypeControlOptions;
        mapTypeId?: MapTypeId | string;
        maxZoom?: number;
        minZoom?: number;
        noClear?: boolean;
        panControl?: boolean;
        panControlOptions?: PanControlOptions;
        restriction?: MapRestriction;
        rotateControl?: boolean;
        rotateControlOptions?: RotateControlOptions;
        scaleControl?: boolean;
        scaleControlOptions?: ScaleControlOptions;
        scrollwheel?: boolean;
        streetView?: StreetViewPanorama;
        streetViewControl?: boolean;
        streetViewControlOptions?: StreetViewControlOptions;
        styles?: MapTypeStyle[];
        tilt?: number;
        zoom?: number;
        zoomControl?: boolean;
        zoomControlOptions?: ZoomControlOptions;
      }

      interface MapTypeStyle {
        elementType?: "all" | "geometry" | "geometry.fill" | "geometry.stroke" | "labels" | "labels.icon" | "labels.text" | "labels.text.fill" | "labels.text.stroke";
        featureType?: string;
        stylers?: any[];
      }

      enum MapTypeId {
        HYBRID,
        ROADMAP,
        SATELLITE,
        TERRAIN,
      }

      interface FullscreenControlOptions {
        position?: ControlPosition;
      }

      interface MapTypeControlOptions {
        mapTypeIds?: (MapTypeId | string)[];
        position?: ControlPosition;
        style?: MapTypeControlStyle;
      }

      interface PanControlOptions {
        position?: ControlPosition;
      }

      interface RotateControlOptions {
        position?: ControlPosition;
      }

      interface ScaleControlOptions {
        style?: ScaleControlStyle;
      }

      interface StreetViewControlOptions {
        position?: ControlPosition;
      }

      interface ZoomControlOptions {
        position?: ControlPosition;
      }

      interface MapRestriction {
        latLngBounds: LatLngBounds | { east: number; north: number; south: number; west: number };
        strictBounds?: boolean;
      }

      enum ControlPosition {
        BOTTOM_CENTER,
        BOTTOM_LEFT,
        BOTTOM_RIGHT,
        CENTER,
        LEFT_BOTTOM,
        LEFT_CENTER,
        LEFT_TOP,
        RIGHT_BOTTOM,
        RIGHT_CENTER,
        RIGHT_TOP,
        TOP_CENTER,
        TOP_LEFT,
        TOP_RIGHT,
      }

      enum MapTypeControlStyle {
        DEFAULT,
        DROPDOWN_MENU,
        HORIZONTAL_BAR,
      }

      enum ScaleControlStyle {
        DEFAULT,
      }

      interface IconSequence {
        fixedRotation?: boolean;
        icon: Symbol;
        offset?: string;
        repeat?: string;
      }

      interface Symbol {
        anchor?: Point;
        fillColor?: string;
        fillOpacity?: number;
        path?: SymbolPath | string;
        rotation?: number;
        scale?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
      }

      enum SymbolPath {
        BACKWARD_CLOSED_ARROW,
        BACKWARD_OPEN_ARROW,
        CIRCLE,
        FORWARD_CLOSED_ARROW,
        FORWARD_OPEN_ARROW,
      }

      interface MarkerImage {
        url: string;
        size?: Size;
        origin?: Point;
        anchor?: Point;
        scaledSize?: Size;
      }

      interface Marker {
        getAnimation(): Animation | undefined;
        getAttribute(attribute: string): any;
        getClickable(): boolean;
        getCursor(): string;
        getDraggable(): boolean;
        getIcon(): string | Icon | MarkerImage | google.maps.SymbolPath | undefined;
        getMap(): Map | null;
        getOpacity(): number;
        getPosition(): LatLng | undefined;
        getShape(): MarkerShape | null;
        getTitle(): string;
        getVisible(): boolean;
        getZIndex(): number;
        setAnimation(animation: Animation | undefined): void;
        setAttribute(attribute: string, value: any): void;
        setClickable(clickable: boolean): void;
        setCursor(cursor: string | null): void;
        setDraggable(draggable: boolean): void;
        setIcon(icon: string | Icon | MarkerImage | SymbolPath | undefined): void;
        setMap(map: Map | null): void;
        setOpacity(opacity: number): void;
        setPosition(latlng: LatLng | { lat: number; lng: number }): void;
        setShape(shape: MarkerShape | null): void;
        setTitle(title: string): void;
        setVisible(visible: boolean): void;
        setZIndex(zIndex: number): void;
        addListener(eventName: string, listener: (...args: any[]) => void): google.maps.MapsEventListener;
      }

      interface MarkerShape {
        type: "circle" | "poly" | "rect";
        coords?: number[];
      }

      interface Polyline {
        getClickable(): boolean;
        getDraggable(): boolean;
        getEditable(): boolean;
        getGeodesic(): boolean;
        getIcons(): IconSequence[];
        getMap(): Map | null;
        getPath(): LatLng[];
        getStrokeColor(): string;
        getStrokeOpacity(): number;
        getStrokeWeight(): number;
        getVisible(): boolean;
        getZIndex(): number;
        setClickable(clickable: boolean): void;
        setDraggable(draggable: boolean): void;
        setEditable(editable: boolean): void;
        setGeodesic(geodesic: boolean): void;
        setIcons(icons: IconSequence[]): void;
        setMap(map: Map | null): void;
        setOptions(options: PolylineOptions): void;
        setPath(path: Array<LatLng | { lat: number; lng: number }>): void;
        setStrokeColor(color: string): void;
        setStrokeOpacity(opacity: number): void;
        setStrokeWeight(weight: number): void;
        setVisible(visible: boolean): void;
        setZIndex(zIndex: number): void;
      }

      interface Polygon extends Polyline {
        getFillColor(): string;
        getFillOpacity(): number;
        getPaths(): Array<LatLng[] | LatLng>;
        setFillColor(color: string): void;
        setFillOpacity(opacity: number): void;
        setPaths(paths: Array<Array<LatLng | { lat: number; lng: number }> | LatLng | { lat: number; lng: number }>): void;
      }

      interface InfoWindow {
        close(): void;
        getContent(): string | HTMLElement;
        getPosition(): LatLng | undefined;
        getZIndex(): number;
        open(map: Map | StreetViewPanorama | null, anchor?: Marker | LatLng): void;
        setContent(content: string | HTMLElement): void;
        setOptions(options: InfoWindowOptions): void;
        setPosition(position: LatLng | { lat: number; lng: number }): void;
        setZIndex(zIndex: number): void;
        addListener(eventName: string, listener: (...args: any[]) => void): google.maps.MapsEventListener;
      }

      interface InfoWindowOptions {
        ariaLabel?: string;
        content?: string | HTMLElement;
        disableAutoPan?: boolean;
        maxWidth?: number;
        minWidth?: number;
        pixelOffset?: Size;
        position?: LatLng | { lat: number; lng: number };
        zIndex?: number;
      }

      interface StreetViewPanorama {
        setVisible(visible: boolean): void;
      }

      interface MapsEventListener {
        remove(): void;
      }

      interface MapMouseEvent {
        latLng?: LatLng;
        placeId?: string;
        stop(): void;
      }

      interface Animation {
        DROP?: number;
        BOUNCE?: number;
      }

      interface Geocoder {
        geocode(request: GeocoderRequest, callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void): void;
        geocode(request: GeocoderRequest): Promise<{ results: GeocoderResult[] }>;
      }

      interface GeocoderRequest {
        address?: string;
        bounds?: LatLngBounds;
        componentRestrictions?: { administrativeArea?: string; country?: string; postalCode?: string };
        location?: LatLng | { lat: number; lng: number };
        placeId?: string;
        region?: string;
      }

      interface GeocoderResult {
        address_components: GeocoderAddressComponent[];
        formatted_address: string;
        geometry: GeocoderGeometry;
        place_id: string;
        plus_code?: GeocoderLocationType;
        types: string[];
        name?: string; // POI name (e.g., "دائرة صحة الأنبار")
      }

      interface GeocoderAddressComponent {
        long_name: string;
        short_name: string;
        types: string[];
      }

      interface GeocoderGeometry {
        location: LatLng;
        location_type: GeocoderLocationType;
        bounds?: LatLngBounds;
        viewport?: LatLngBounds;
      }

      enum GeocoderLocationType {
        ROOFTOP,
        RANGE_INTERPOLATED,
        GEOMETRIC_CENTER,
        APPROXIMATE,
      }

      enum GeocoderStatus {
        OK,
        ZERO_RESULTS,
        OVER_QUERY_LIMIT,
        REQUEST_DENIED,
        INVALID_REQUEST,
        UNKNOWN_ERROR,
      }

      interface DirectionsService {
        route(request: DirectionsRequest, callback: (result: DirectionsResult | null, status: DirectionsStatus) => void): void;
      }

      interface DirectionsRequest {
        alternatives?: boolean;
        arrival_time?: Date;
        avoid_highways?: boolean;
        avoid_indoor?: boolean;
        avoid_tolls?: boolean;
        departure_time?: Date;
        destination?: string | LatLng | { lat: number; lng: number };
        language?: string;
        origin?: string | LatLng | { lat: number; lng: number };
        region?: string;
        travelMode?: TravelMode;
        unitSystem?: UnitSystem;
        waypoints?: Array<string | LatLng | { lat: number; lng: number }>;
      }

      interface DirectionsResult {
        geocoded_waypoints: DirectionsGeocodedWaypoint[];
        routes: DirectionsRoute[];
      }

      interface DirectionsGeocodedWaypoint {
        partial_match: boolean;
        place_id: string;
        types: string[];
      }

      interface DirectionsRoute {
        bounds: LatLngBounds;
        copyrights: string;
        legs: DirectionsLeg[];
        overview_path: LatLng[];
        overview_polyline: DirectionsPolyline;
        summary: string;
        warnings: string[];
        waypoint_order: number[];
      }

      interface DirectionsLeg {
        arrival_time?: Time;
        departure_time?: Time;
        distance: TextValueObject;
        duration: TextValueObject;
        duration_in_traffic?: TextValueObject;
        end_address: string;
        end_location: LatLng;
        start_address: string;
        start_location: LatLng;
        steps: DirectionsStep[];
        via_waypoints: LatLng[];
      }

      interface DirectionsStep {
        distance: TextValueObject;
        duration: TextValueObject;
        end_location: LatLng;
        instructions: string;
        maneuver?: string;
        path: LatLng[];
        start_location: LatLng;
        steps?: DirectionsStep[];
        transit_details?: TransitDetails;
        travel_mode: TravelMode;
      }

      interface DirectionsPolyline {
        points: string;
      }

      interface TextValueObject {
        text: string;
        value: number;
      }

      interface Time {
        text: string;
        time_zone: string;
        value: Date;
      }

      interface TransitDetails {
        arrival_stop: TransitStop;
        arrival_time: Time;
        departure_stop: TransitStop;
        departure_time: Time;
        headsign: string;
        headway: number;
        line: TransitLine;
        num_stops: number;
      }

      interface TransitStop {
        location: LatLng;
        name: string;
      }

      interface TransitLine {
        agencies: TransitAgency[];
        color: string;
        icon: string;
        name: string;
        short_name: string;
        text_color: string;
        url: string;
        vehicle: TransitVehicle;
      }

      interface TransitAgency {
        name: string;
        phone: string;
        url: string;
      }

      interface TransitVehicle {
        icon: string;
        local_icon: string;
        name: string;
        type: string;
      }

      enum TravelMode {
        DRIVING,
        BICYCLING,
        TRANSIT,
        WALKING,
      }

      enum UnitSystem {
        METRIC,
        IMPERIAL,
      }

      enum DirectionsStatus {
        OK,
        NOT_FOUND,
        ZERO_RESULTS,
        MAX_WAYPOINTS_EXCEEDED,
        INVALID_REQUEST,
        OVER_QUERY_LIMIT,
        REQUEST_DENIED,
        UNKNOWN_ERROR,
      }

      // ========== Places API Types ==========
      namespace places {
        enum PlacesServiceStatus {
          OK,
          ZERO_RESULTS,
          NOT_FOUND,
          INVALID_REQUEST,
          OVER_QUERY_LIMIT,
          REQUEST_DENIED,
          UNKNOWN_ERROR,
        }

        interface PlaceResult {
          name?: string;
          place_id?: string;
          geometry?: PlaceGeometry;
          formatted_address?: string;
          types?: string[];
          vicinity?: string;
          rating?: number;
          user_ratings_total?: number;
          photos?: PlacePhoto[];
          opening_hours?: OpeningHours;
        }

        interface PlaceGeometry {
          location: LatLng;
          viewport?: LatLngBounds;
        }

        interface PlacePhoto {
          height: number;
          width: number;
          html_attributions: string[];
          getUrl(opts?: PhotoOptions): string;
        }

        interface PhotoOptions {
          maxWidth?: number;
          maxHeight?: number;
        }

        interface OpeningHours {
          open_now?: boolean;
          periods?: OpeningPeriod[];
          weekday_text?: string[];
        }

        interface OpeningPeriod {
          open: OpeningHoursTime;
          close?: OpeningHoursTime;
        }

        interface OpeningHoursTime {
          day: number;
          hours: number;
          minutes: number;
          time: string;
        }

        interface PlaceSearchRequest {
          location: LatLng | { lat: number; lng: number };
          radius: number;
          keyword?: string;
          name?: string;
          type?: string;
          language?: string;
        }

        class PlacesService {
          constructor(map: Map);
          nearbySearch(
            request: PlaceSearchRequest,
            callback: (results: PlaceResult[] | null, status: PlacesServiceStatus) => void
          ): void;
          getDetails(
            request: { placeId: string; fields?: string[]; sessionToken?: AutocompleteSessionToken },
            callback: (result: PlaceResult | null, status: PlacesServiceStatus) => void
          ): void;
        }

        // ========== New Places API (recommended replacements) ==========

        /** 
         * FormattableText - text with match highlights 
         */
        interface FormattableText {
          text: string;
          matches?: Array<{ offset: number; length: number }>;
        }

        /**
         * PlacePrediction - from AutocompleteSuggestion API
         */
        interface PlacePrediction {
          placeId: string;
          mainText: FormattableText;
          secondaryText: FormattableText | null;
          text: FormattableText;
          distanceMeters: number | null;
          types: string[];
          toPlace(): Place;
        }

        /**
         * AutocompleteSuggestion - replaces AutocompleteService
         */
        class AutocompleteSuggestion {
          placePrediction: PlacePrediction | null;

          static fetchAutocompleteSuggestions(
            request: {
              input: string;
              locationBias?: { center: LatLng | { lat: number; lng: number }; radius: number } | LatLngBounds;
              locationRestriction?: { center: LatLng | { lat: number; lng: number }; radius: number } | LatLngBounds;
              includedRegionCodes?: string[];
              includedPrimaryTypes?: string[];
              language?: string;
              origin?: LatLng | { lat: number; lng: number };
              region?: string;
              sessionToken?: AutocompleteSessionToken;
            }
          ): Promise<{ suggestions: AutocompleteSuggestion[] }>;
        }

        /**
         * Place (New) - replaces PlacesService
         */
        class Place {
          constructor(options: { id: string; requestedLanguage?: string });

          // Properties (populated after fetchFields)
          readonly displayName: string | null;
          readonly formattedAddress: string | null;
          readonly location: LatLng | null;
          readonly id: string;
          readonly types: string[];
          readonly addressComponents: Array<{
            longText: string;
            shortText: string;
            types: string[];
          }> | null;

          fetchFields(options: { fields: string[] }): Promise<{ place: Place }>;

          static searchNearby(request: {
            fields: string[];
            locationRestriction: {
              center: LatLng | { lat: number; lng: number };
              radius: number;
            };
            includedTypes?: string[];
            excludedTypes?: string[];
            includedPrimaryTypes?: string[];
            excludedPrimaryTypes?: string[];
            maxResultCount?: number;
            languageCode?: string;
            rankPreference?: 'POPULARITY' | 'DISTANCE';
          }): Promise<{ places: Place[] }>;
        }
      }
      // ========== End Places API Types ==========

      namespace visualization {
        interface HeatmapLayerOptions {
          data?: Array<LatLng | { lat: number; lng: number }>;
          dissipating?: boolean;
          gradient?: string[];
          map?: Map;
          maxIntensity?: number;
          opacity?: number;
          radius?: number;
        }

        interface HeatmapLayer {
          setData(data: Array<LatLng | { lat: number; lng: number }>): void;
          setMap(map: Map | null): void;
          setOptions(options: HeatmapLayerOptions): void;
        }

        class HeatmapLayer {
          constructor(options?: HeatmapLayerOptions);
        }
      }
    }
  }
}

export {};
